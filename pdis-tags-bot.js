var axios = require('axios');
var Promise = require('es6-promise').Promise;
var tags;
var new_tags;
var topic;
var topic_id;
var topic_slug;
var topic_tags;
var keywords;
var apikey;
var apiuser;

module.exports = function (context, cb) {
    console.log(context);
    apikey = context.secrets.apikey;
    apiuser = context.secrets.apiuser;
    topic = context.body.topic;
    topic_id = topic.id;
    topic_slug = topic.slug;
    topic_tags = topic.tags.slice();
    new_tags = topic.tags.slice();

    go().then((result) => {
        cb(null, result);
    });

};

var go = async function () {

    await get_tags();

    // add tags by match topic title
    new_tags = check_title(new_tags);

    // add tags by match sayit content
    let links = await get_sayit_link();
    let contents = await get_sayit_content(links);
    new_tags = check_sayit_content(new_tags, contents);

    // update new tags to discourse
    let result = await update_discourse(new_tags);
    return result;

};

function get_tags(){
    return axios.get("https://raw.githubusercontent.com/PDIS/discourse-tagger/master/tags.json")
        .then(body=>{
            tags = body.data;
        });
}

function check_sayit_content(old_tags, contents) {

    new_tags = old_tags.slice();
    if(contents.length > 0)
    {
        let all_content = contents.reduce((all, content) => all + content);
        Object.keys(tags).forEach((tag) => {
            keywords = tags[tag];
            if (keywords.filter(keyword => all_content.toLowerCase().includes(keyword)).length > 0) {
                new_tags.push(tag)
            }
        });
    }

    return new_tags;
}

function check_title(old_tags) {

    new_tags = old_tags.slice();

    Object.keys(tags).forEach((tag) => {
        keywords = tags[tag];
        if (keywords.filter(keyword => topic.title.toLowerCase().includes(keyword)).length > 0) {
            new_tags.push(tag);
        }
    })

    return new_tags;
}

function get_sayit_link() {
    return axios.get("https://talk.pdis.nat.gov.tw/t/" + topic.id + ".json")
        .then(body => {
            let links = [];
            body.data.details.links
                .filter(link => link.url.includes("sayit"))
                .map(link => links.push(link.url));
            return links;
        });
}

function get_sayit_content(links) {
    let promises = [];
    links.map(link => promises.push(axios.get(link + ".an")))
    return Promise.all(promises)
        .then(function (contents) {
            return contents.map(content => content.data)
        });
}

function update_discourse() {
    if (new_tags.some(val => topic_tags.indexOf(val) === -1)) {
        return axios.put(
            'https://talk.pdis.nat.gov.tw/t/' + topic_slug + '/' + topic_id + '?api_key=' + apikey + '&api_user=' + apiuser,
            { "tags": new_tags })
        .then(body => body.data)
        .catch(err => err);
    }
    return Promise.resolve(tags);
}

