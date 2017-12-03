const Apify = require('apify');
const utils = require('apify/build/utils');
require('puppeteer');

const humanDelay = ms => (Math.random() + 1) * ms;

const saveScreen = async (page, key) => {
    const screenshotBuffer = await page.screenshot();
    await Apify.setValue(key, screenshotBuffer, { contentType: 'image/png' });
    const html = await page.evaluate('document.documentElement.outerHTML');
    await Apify.setValue(key+'txt', html, { contentType: 'text/html' });
};

const deleteAllCurrentCookies = async (page) => {
    const cookies = await page.cookies();
    await page.deleteCookie(...cookies);
};

Apify.main(async () => {
    const results = [];
    const failedUrls = [];

    const input = await Apify.getValue('INPUT');

    if (!input || !input.url) throw new Error('Invalid input, must be a JSON object with the "url" field!');

    console.log('Launching Puppeteer...');
    const opts = {
        args: [
            '--disable-web-security',
        ]
    };
    var proxyUrl = 'http://onmedia:L2ZpqMd2AV@185.176.229.3:60000';
    opts.proxyUrl = proxyUrl;
    const browser = await Apify.launchPuppeteer(opts);
    var page = await browser.newPage();

    const storeId = process.env.APIFY_DEFAULT_KEY_VALUE_STORE_ID;
    console.log(`https://api.apify.com/v2/key-value-stores/${storeId}/`);

    /*
        The page.goto will throw an error if:
        - there's an SSL error (e.g. in case of self-signed certificates).
        - target URL is invalid.
        - the timeout is exceeded during navigation.
        - the main resource failed to load.
     */
    try {
        await page.goto('https://www.luisaviaroma.com/en-us/shop/women/clothing/?lvrid=_gw_i1', { waitUntil: 'networkidle2' });
    } catch (error) {
        console.error('https://www.luisaviaroma.com/en-us/shop/women/clothing', error);
        return; // stop act execution
    }
    const crawlerList = async (page) => {
        var detailsUrl = await page.evaluate(() => {
            const links =  document.querySelectorAll('div[class*="article"] a');
            return [].map.call(links, a => a.href);
        });

        var hrefNextPage = await page.evaluate(() => {
            if (document.querySelectorAll('a[class="next_page"]').length!==0){
                return document.querySelectorAll('a[class="next_page"]')[0].href;
            }
            else
            {
                return '';
            }
        });

        console.log(hrefNextPage);
        console.log(detailsUrl.length);

        for (var i = 0; i < detailsUrl.length; i++) {
            try {
                await deleteAllCurrentCookies(page);
                console.log(detailsUrl[i]);
                await page.goto(detailsUrl[i],{ waitUntil: 'domcontentloaded',timeout: 3000000 });

                /*
                    The page.evaluate will throw an error if:
                    - the inner function throws an exception.
                 */
                var result = await page.evaluate(() => {
                    var result = {};

                    if (window.itemResponse !== undefined){
                        var images = [];
                        $.each(itemResponse.ItemPhotos,function(){
                            images.push(window.location.origin +'/'+$(this)[0].Path);
                        });

                        var variants = [];
                        var stock_total = 0;
                        $.each(itemResponse.ItemAvailability,function(){
                            variants.push({'descriptionNumberItems':$(this)[0].SizeId, 'descriptionCountrySize':$(this)[0].SizeValue,'price':'','inStockCount':1});
                            stock_total += 1;
                        })

                        var dateNow = new Date();
                        result.categories_json = itemResponse.Category.Description;
                        result.title = itemResponse.ShortDescription;
                        result.designer_name = itemResponse.Designer.Description;
                        result.manufacturer = itemResponse.Designer.Description;
                        result.itemId = itemResponse.ItemKey.ItemCode;
                        result.sku = itemResponse.ItemKey.ItemCode;
                        result.price = itemResponse.Pricing[0].Prices[0].ListPrice;
                        result.sale_price = itemResponse.Pricing[0].Prices[0].DiscountedPrice;
                        result.source = 'luisaviaroma';
                        result.currency = itemResponse.Pricing[0].Prices[0].CurrencyId;
                        result.description = itemResponse.LongDescription;
                        result.mapped_category = itemResponse.Category.Id;
                        result.images = images;
                        result.stock_total = stock_total;
                        result.composition = itemResponse.Composition;
                        //result.long_description = '';
                        result.variants = variants;
                        result.date = dateNow.toUTCString();
                        return result ;
                    } else {
                        // throw an exception so that we know which url failed
                        throw new Error('Window property itemResponse does not exist.')
                    }
                })
                results.push(result);
            } catch (error) {
                console.error(`URL ${detailsUrl[i]} failed.`)
                // store failing url into a list
                failedUrls.push({
                    url: detailsUrl[i],
                    error,
                })
            }
        }

        await Apify.setValue('OUTPUT', results);
        await Apify.setValue('FAILED_URLS', failedUrls);

        console.log('NP:'+hrefNextPage)

        if (hrefNextPage!==''){
            try {
                await deleteAllCurrentCookies(page);
                await page.goto(hrefNextPage,{ waitUntil: 'networkidle0',timeout: 3000000 });
            } catch (error) {
                console.error(`Navigation to page "${hrefNextPage}" failed`);
            }
            await crawlerList(page);
        }
    }
    await crawlerList(page);

    console.log('Closing Puppeteer...');
    await browser.close();

    // print out correct and also incorrect outputs
    await Apify.setValue('OUTPUT', results);
    await Apify.setValue('FAILED_URLS', failedUrls);

    console.log('Done.');
});
