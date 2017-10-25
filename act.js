const puppeteer = require('puppeteer')
const Apify = require('apify')
const util = require('util')
const _ = require('lodash')
const async = require('async')
const cheerio = require('cheerio')
const request = require('request')
const leftPad = require('left-pad')
const URL = require('url')
const { typeCheck } = require('type-check')

console.log(`Starting (${JSON.stringify(process.versions)})`)


// Definition of the input
const INPUT_TYPE = `{
    urls: [String],
    urlToTextFileWithUrls: Maybe String,
    concurrency: Maybe Number,
    storePagesInterval: Maybe Number,
    screenshotWidth: Maybe Number,
    screenshotHeight: Maybe Number
}`

const DEFAULT_STATE = {
  storeCount: 0,
  pageCount: 0,
}
const DEFAULT_STORE_PAGES_INTERVAL = 20
const DEFAULT_CONCURRENCY = 1

// Input object
let input

// Objects holding the state of the crawler, which is stored under the 'STATE' key in the KV store
let state

// Array of Result records that were finished but not yet stored to KV store
const results = []

let lastStoredAt = new Date()

// Indicates that results and state are currently being stored
let isStoring = false

// Which XHR requests should be stored with response
const valueableContentTypes = ['text/html', 'application/json', 'application/ld+json']

// Helper function to remove circular references from objects
function cleanData(data) {
  let cache = []
  const result = JSON.parse(JSON.stringify(data, (key, value) => {
    if (typeof value === 'function') return 'function'
    if (typeof value === 'object' && value !== null) {
      if (cache.indexOf(value) !== -1) {
        return null
      }
      cache.push(value)
    }
    return value
  }))
  cache = null // clean memory
  return result
}

// attempt to parse JSON response, save error if parsing fails
async function parseJSONResponse(response) {
  let result
  try {
    const json = await response.json()
    result = {
      valid: true,
      data: json,
    }
  } catch (err) {
    // Parsing JSON failed
    result = {
      valid: false,
      error: err,
    }
  }
  return result
}

// parse response and store status, headers and body
async function parseResponse(response) {
  const result = {}
  result.status = response.status
  result.headers = response.headers

  // ignore body if request failed remove this optimization if you want to store
  // errors too
  if (Number(result.status || 200) > 300) return result

  const contentType = response.headers['content-type']
  const valueableType = valueableContentTypes.filter(ct => (
    contentType && contentType.indexOf(ct) !== -1
  ))
  // ignore body if it's not important
  if (!valueableType.length) return result

  try {
    if (contentType === 'application/json') {
      result.body = await parseJSONResponse(response)
    } else {
      result.body = await response.text()
    }
  } catch (err) {
    // Parsing BODY Failed, log error
    console.log(err)
  }
  return result
}

// Evaluate window properties, save content for variables that are not function
function evalWindowProperties(properties) {
  const result = {}
  let cache = []
  properties.forEach(property => {
    const propertyContent = window[property] // eslint-disable-line
    switch (typeof propertyContent) {
      // Skip functions, used switch for future improvements
      case 'function':
        result[property] = 'function'
        break
      default:
        try {
          // remove circular references and functions from variable content
          result[property] = JSON.parse(JSON.stringify(propertyContent, (key, value) => {
            if (typeof value === 'function') return 'function'
            if (typeof value === 'object' && value !== null) {
              if (cache.indexOf(value) !== -1) {
                return null
              }
              cache.push(value)
            }
            return value
          }))
        } catch (err) {
          result[property] = err
        }
    }
  })
  cache = null
  return result
}

// Parse Schema.org data from website
function parseSchemaOrgData($) {
  function extractValue($elem) {
    return $elem.attr('content')
      || $elem.text()
      || $elem.attr('src')
      || $elem.attr('href')
      || null
  }

  function extractItemScope($itemScope) {
    const item = { _type: $itemScope.attr('itemtype') }
    let count = 0
    // iterate itemprops not nested in another itemscope
    $itemScope
      .find('[itemprop]')
      .filter(function () {
        const $itemProp = $(this)
        const $parents = $itemProp.parents('[itemscope]')
        return $($parents[0]).is($itemScope)
      })
      .each(function () {
        const $itemProp = $(this)
        let value = $itemProp.is('[itemscope]') ? extractItemScope($itemProp) : extractValue($itemProp)
        if (typeof (value) === 'string') {
          value = value.trim()
        }
        const propName = $itemProp.attr('itemprop')
        if (Array.isArray(item[propName])) {
          item[propName].push(value)
        } else if (typeof (item[propName]) !== 'undefined') {
          item[propName] = [item[propName], value]
        } else {
          item[propName] = value
        }
        count++
      })
    // special case - output at least something
    if (count === 0) item._value = extractValue($itemScope)
    return item
  }

  const result = []
  $('[itemscope]')
    .filter(function () {
      return $(this).parents('[itemscope]').length === 0
    })
    .each(function () {
      result.push(extractItemScope($(this)))
    })

  // remove circular references
  return cleanData(result)
}

// Parse all meta tags
function parseMetadata($) {
  const result = {}
  $('meta').each(function () {
    const $tag = $(this)
    const name = $tag.attr('name') || $tag.attr('property')
    if (name) result[name] = $tag.attr('content')
  })

  return result
}

// Parse all JSON LD items
function parseJsonLD($) {
  const result = []
  $('script[type="application/ld+json"]').each(function () {
    try {
      result.push(JSON.parse($(this).html()))
    } catch (err) {
      console.error(err)
    }
  })
  return result
}

let nativeWindowsProperties = null

// Downloads list of URLs from an external text file and adds valid URLs to input.urls
const addUrlsFromTextFile = async (input) => {
  console.log(`Fetching text file from ${input.urlToTextFileWithUrls}`)
  const request = await requestPromised({ url: input.urlToTextFileWithUrls })
  const textFile = request.body

  console.log(`Processing URLs from text file (length: ${textFile.length})`)
  let count = 0
  textFile.split('\n').forEach((url) => {
    url = url.trim()
    const parsed = URL.parse(url)
    if (parsed.host) {
      count++
      input.urls.push(url)
    }
  })

  console.log(`Added ${count} URLs from the text file`)
}


// If there's a long enough time since the last storing,
// the function stores finished pages and the current state to the key-value store.
const maybeStoreResults = async (force) => {
  // Is there anything to store?
  if (results.length === 0) return

  // Is it long enough time since the last storing?
  if (!force && results.length < input.storePagesInterval) return

  // Isn't some other worker storing data?
  if (isStoring) return
  isStoring = true

  try {
    // Store buffered pages to store under key RESULTS-XXX
    // Careful here, results array might be added more records while awaiting setValue()
    const recordsToStore = _.clone(results)
    const key = `RESULTS-${leftPad(state.storeCount + 1, 9, '0')}`

    console.log(`Storing ${recordsToStore.length} page records to ${key} (total pages crawled: ${state.pageCount + recordsToStore.length})`)
    await Apify.setValue(key, recordsToStore)

    results.splice(0, recordsToStore.length)

    // Update and save state (but only after saving pages!)
    state.pageCount += recordsToStore.length
    state.storeCount++
    await Apify.setValue('STATE', state)

    lastStoredAt = new Date()
  } catch (e) {
    // This is a fatal error, immediately stop the act
    if (e.message && e.message.indexOf('The POST payload is too large') >= 0) {
      console.log('FATAL ERROR')
      console.log(e.stack || e)
      process.exit(1)
    }
    if (force) throw e
    console.log(`ERROR: Cannot store data (will be ignored): ${e.stack || e}`)
  } finally {
    isStoring = false
  }
}

async function analysePage({ browser, url }) {
  const result = {
    url,
    // TODO: Fix order of fields
    errorInfo: null,
    loadedUrl: null,
    requestedAt: null,
    loadedAt: null,
    analysedAt: null,
    responseStatus: null,
    responseHeaders: null,
    responseTotalBytes: 0,
    iframeCount: null,
    scriptCount: null,
    metadata: null,
    schemaOrgData: null,
    jsonld: null,
    windowProperties: null,
    requests: [],
    html: null,
    text: null,
    screenshotPngBase64: null,
  }

  let page = null

  try {
    page = await browser.newPage()

    page.on('error', (err) => {
      console.log(`Web page crashed (${url}): ${err}`)
      page.close().catch((err2) => console.log(`Error closing page 1 (${url}): ${err2}`))
    })

    // On first run, get list of native window properties from the browser
    if (!nativeWindowsProperties) {
      const keys = await page.evaluate(() => Object.keys(window)) // eslint-disable-line
      // Other concurrent worker might have done the same in the meantime
      if (!nativeWindowsProperties) {
        console.log(`Found ${keys.length} native 'window' object properties`)
        nativeWindowsProperties = {}
        _.each(keys, (key) => {
          nativeWindowsProperties[key] = true
        })
      }
    }

    if (input.screenshotWidth > 0 && input.screenshotHeight > 0) {
      page.setViewport({
        width: input.screenshotWidth,
        height: input.screenshotHeight,
      })
    }

    // Key is requestId, value is record in result.requests
    const requestIdToRecord = {}

    // ID of the main page request
    let initialRequestId = null

    const getOrCreateRequestRecord = (requestId) => {
      let rec = requestIdToRecord[requestId]
      if (!rec) {
        rec = requestIdToRecord[requestId] = {
          url: null,
          method: null,
          responseStatus: null,
          responseHeaders: null,
          responseBytes: 0,
        }
        result.requests.push(rec)
      }
      return rec
    }

    page.on('request', (request) => {
      if (!initialRequestId) initialRequestId = request._requestId
      const rec = getOrCreateRequestRecord(request._requestId)
      rec.url = request.url
      rec.method = request.method
    })

    // WORKAROUND: Puppeteer's Network.loadingFinished handler doesn't store encodedDataLength field
    page._networkManager._client.on('Network.dataReceived', (params) => {
      const rec = getOrCreateRequestRecord(params.requestId)
      if (rec) rec.responseBytes += params.encodedDataLength || 0
      result.responseTotalBytes += params.encodedDataLength || 0
    })

    page.on('response', async (response) => {
      const request = response.request()
      const rec = getOrCreateRequestRecord(request._requestId)
      if (rec) {
        const data = await parseResponse(response)
        rec.responseStatus = data.status
        rec.responseHeaders = data.headers
        rec.responseBody = data.body
      }
    })

    console.log(`Loading page: ${url}`)
    result.requestedAt = new Date()
    await page.goto(url)

    console.log(`Page loaded: ${url}`)

    const rec = requestIdToRecord[initialRequestId]
    if (rec) {
      result.responseStatus = rec.responseStatus
      result.responseHeaders = rec.responseHeaders
    }

    result.loadedAt = new Date()
    result.loadedUrl = await page.url()

    const evalData = await page.evaluate(() => ({
      html: document.documentElement.innerHTML, // eslint-disable-line
      text: document.documentElement.innerText, // eslint-disable-line
      iframeCount: document.querySelectorAll('iframe').length, // eslint-disable-line
      scriptCount: document.querySelectorAll('script').length, // eslint-disable-line
      allWindowProperties: Object.keys(window) // eslint-disable-line
    }))

    Object.assign(result, _.pick(evalData, 'html', 'text', 'iframeCount', 'scriptCount'))

    // Extract list of non-native window properties
    const windowProperties = _.filter(
      evalData.allWindowProperties,
      (propName) => !nativeWindowsProperties[propName],
    )

    // Evaluate non-native window properties
    result.windowProperties = await page.evaluate(
      evalWindowProperties,
      windowProperties,
    )

    try {
      const $ = cheerio.load(result.html)
      result.schemaOrgData = parseSchemaOrgData($)
      result.metadata = parseMetadata($)
      result.jsonld = parseJsonLD($)
    } catch (err) {
      console.error(err)
    }

    result.analysedAt = new Date()
  } catch (e) {
    console.log(`Loading of web page failed (${url}): ${e}`)
    result.errorInfo = e.stack || e.message || String(e)
  } finally {
    if (page) {
      page.close().catch((e) => console.log(`Error closing page 2 (${url}): ${e}`))
    }
  }

  console.log(`Page finished: ${result.url}`)

  results.push(result)
  await maybeStoreResults()
}

Apify.main(async () => {
  // Fetch and check the input
  input = await Apify.getValue('INPUT')
  if (!typeCheck(INPUT_TYPE, input)) {
    console.error('Expected input:')
    console.error(INPUT_TYPE)
    console.error('Received input:')
    console.error(util.inspect(input))
    throw new Error('Received invalid input')
  }

  if (!(input.storePagesInterval > 0)) input.storePagesInterval = DEFAULT_STORE_PAGES_INTERVAL
  if ((!input.concurrency > 0)) input.concurrency = DEFAULT_CONCURRENCY

  // Prepare list of URLs
  input.urls = input.urls || []
  if (input.urlToTextFileWithUrls) addUrlsFromTextFile(input)

  // Get the state of crawling (the act might have been restarted)
  state = await Apify.getValue('STATE')
  if (state) console.log(`Reusing persisted state: ${JSON.stringify(state)}`)
  else state = DEFAULT_STATE

  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    headless: !!process.env.APIFY_HEADLESS,
    // dumpio: true,
    // slowMo: 1000
  })

  // Load pages in asynchronous queue with a specified concurrency
  const queue = async.queue(analysePage, input.concurrency)

  // Push all not-yet-crawled URLs to to the queue
  if (state.pageCount > 0) {
    console.log(`Skipping first ${state.pageCount} pages that were already crawled`)
    input.urls.splice(0, state.pageCount)
  }
  input.urls.forEach((url) => {
    queue.push({ browser, url }, (err) => {
      if (err) console.log(`WARNING: Unhandled exception from worker function: ${err.stack || err}`)
    })
  })

  // Wait for the queue to finish all tasks
  if (input.urls.length > 0) {
    await new Promise((resolve) => {
      queue.drain = resolve
    })
  }

  // Force store results
  await maybeStoreResults(true)

  console.log('Done')
})
