'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = crawlerTemplate;
function crawlerTemplate({
    requiresJQuery,
    requiresSchemaOrg,
    crawlerItems
}) {
    return `
function pageFunction(context) {
    ${requiresJQuery ? 'var $ = context.jQuery;' : ''}
    ${requiresSchemaOrg ? `
    var extractValue = function(elem) {
        return $(elem).attr("content") || $(elem).text()
               || $(elem).attr("src") || $(elem).attr("href") || null;
    };

    var addProperty = function(item,propName,value) {
        if( typeof(value)==='string' )
            value = value.trim();
        if( Array.isArray(item[propName]) )
            item[propName].push(value);
        else if( typeof(item[propName])!=='undefined' )
            item[propName] = [item[propName], value];
        else
            item[propName] = value;
    }

    var extractItem = function(elem) {
        var item = { _type: $(elem).attr("itemtype") };
        var count = 0;
        // iterate itemprops not nested in another itemscope
        $(elem).find("[itemprop]").filter(function() {
            return $(this).parentsUntil(elem, '[itemscope]').length === 0;
        }).each( function() {
            addProperty(
                item,
                $(this).attr("itemprop"),
                $(this).is("[itemscope]") ? extractItem(this) : extractValue(this));
            count++;
        });
        // special case - output at least something
        if( count===0 )
            addProperty(item, "_value", extractValue(elem));
        return item;
    };

    var extractAllItems = function() {
        var items = [];
        // find top-level itemscope elements
        $("[itemscope]").filter(function() {
            return $(this).parentsUntil("body", '[itemscope]').length === 0;
        }).each( function() {
            items.push( extractItem(this) );
        });
        return items;
    };

    var schemaOrg = extractAllItems();
` : ''}
    var parsedData = {};

    ${crawlerItems.join("\n\t")}

    context.finish(parsedData);
}
`;
}