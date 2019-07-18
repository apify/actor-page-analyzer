# Page analyzer

This Apify actor analyzes a web page on a specific URL. You can try out how it works live in the [Page Analyzer](https://apify.com/page-analyzer) on Apify.
This actor extracts HTML and javascript variables from main response and HTML/JSON data from XHR requests.
Then it analyses loaded data:
1) It performs analysis of initial HTML (html loaded directly from response):
- Looks for Schema.org data and if it finds anything, it saves it to output as ``schemaOrgData`` variable.
- Looks for JSON-LD link tags and parses found JSON, if it finds anything it outputs it as ``jsonLDData`` variable.
- Looks for ``meta`` and ``title`` tags and outputs found content as ``metadata`` variable.
2) Loads all XHR requests -> discards request that do no contain HTML or JSON -> parses HTML and JSON into objects
3) When all XHR requests are finished it loads HTML from the rendered page (it might have changed thanks to JS manipulation) and does work from step 1 again because javascript might have changed the HTML of the website.
4) Loads all window variables and discards common global variables (console, innerHeight, navigator, ...), cleans the output (removes all functions and circular paths) and outputs it as ``allWindowProperties`` variable.

When analysis is finished it checks INPUT parameters if there are any strings to search for and if there are. Then it attempts to find the strings in all found content.

The actor ends when all output is parsed and searched. If connection to URL fails or if any part of the actor crashes, the actor ends with error in output and log.

Input to actor is provided from INPUT file. If the actor is run through Apify, then INPUT comes from key value store. If you want to start the actor localy, then call

```
npm run start-local
```
and provide input as a file in directory ``kv-store-dev``.

**INPUT**
```javascript
{
    // url to website, that is supposed to be analyzed
    "url": "http://example.com",
    // array of strings too look for on the website, if empty, search is skipped during analysis
    "searchFor": ["About us"]
}
```

During the actor run, it saves output into OUTPUT file, which is saved in key value store if the actor is run through Apify, or in ``kv-store-dev`` folder if the actor is run localy.

**OUTPUT**
```javascript
{
  // Initial response headers
  "initialResponse": {
    "url": "https://www.flywire.com/",
    "headers": {...}
  },
  // True if window variables were parsed after XHR requests finished
  "windowPropertiesParsed": true,
  // True if meta tags were parsed from initial response
  "metaDataParsed": true,
  // True if Schema.org was loaded and parsed from initial response
  "schemaOrgDataParsed": true,
  // True if JSON-LD was loaded and parsed from initial response
  "jsonLDDataParsed": true,
  // True if HTML was loaded and parsed from initial response
  "htmlParsed": true,
  // True if HTML was loaded and parsed after XHR requests finished
  "htmlFullyParsed": true,
  // True if XHR requests were all parsed
  "xhrRequestsParsed": true,
  // Filtered window properties by search strings
  "windowProperties": {},
  // Object containing cleaned up window object properties
  "allWindowProperties": {...},
  // Array of properties which contain searched strings (at least one) with path to variable from root
  "windowPropertiesFound": [],
  // Schema.org data filtered by search strings.
  "schemaOrgData": {},
  // Array of schema org properties which contain searched strings (at least one) with path to variable from root
  "schemaOrgDataFound": [],
  // Complete output of found schema.org data
  "allSchemaOrgData": [],
  // Complete output of all found meta tags
  "metaData": {
    "viewport": "width=device-width, initial-scale=1",
    "og:title": "International Payments Solution",
    ...
  },
  // List of meta tags matching the searched strings
  "metaDataFound": [],
  // JSON-LD Data filtered by search strings.
  "jsonLDData": {},
  // Array of JSON-LD data properties which contain searched strings (at least one) with path to variable from root
  "jsonLDDataFound": [],
  // Complete output of found JSON-LD
  "allJsonLDData": [],
  // Array of selectors to HTML elements that contain the searched values
  "htmlFound": [],
  // Array of parsed XHR requests with content type of JSON or HTML
  "xhrRequests": [
    {
      "url": "https://www.flywire.com/destinations",
      "method": "GET",
      "responseStatus": 200,
      "responseHeaders": {...},
      "responseBody": {
        // Valid provides information whether JSON was parsed successfully
        "valid": true/false,
        // Data contains the parsed JSON
        "data": [...],
      }
    },
    {
      "url": "https://www.flywire.com/asdasd",
      "method": "GET",
      "responseStatus": 200,
      "responseHeaders": {...},
      // For HTML requests responseBody contains HTML as string
      "responseBody": "<html>...."
    },
  ],
  // same list as above, but filtered by search strings
  "xhrRequestsFound": [...],
  // contains error if actor failed outside of page function
  "error": null,
  // contains error if actor failed in page.evaluate
  "pageError": null,
  "outputFinished": true,

  // timestamps for debugging
  "analysisStarted": "2018-02-09T12:34:49.938Z",
  "scrappingStarted": "2018-02-09T12:34:50.050Z",
  "pageNavigated": "2018-02-09T12:34:53.495Z",
  "windowPropertiesSearched": "2018-02-09T12:34:53.810Z",
  "metadataSearched": "2018-02-09T12:34:51.624Z",
  "schemaOrgSearched": "2018-02-09T12:34:51.627Z",
  "jsonLDSearched": "2018-02-09T12:34:51.625Z",
  "htmlSearched": "2018-02-09T12:34:53.746Z",
  "xhrRequestsSearched": "2018-02-09T12:34:53.517Z",
  "analysisEnded": "2018-02-09T12:34:53.810Z",
}
```
