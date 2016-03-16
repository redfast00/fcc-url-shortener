'use strict';
var fs = require('fs');
var http = require('http');
var url = require('url');
var validURL = require('valid-url');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var appURL = process.env.APP_URL || 'http://localhost';
function insertURL(longURL, callback) {
    MongoClient.connect(process.env.MONGOLAB_URI, function(err, db) {
    assert.equal(null, err);
    console.log("Connected correctly to server.");
    var collection = db.collection("url");
    //10 random characters should suffice (I know it's not ideal)
    var recordToInsert = {
        'longURL': longURL,
        'shortURL': new Array(10).join().replace(/(.|$)/g, function(){return ((Math.random()*36)|0).toString(36)[Math.random()<.5?"toString":"toUpperCase"]();}), //thanks http://stackoverflow.com/a/24810220/5431090
        'dateCreated': Date.now()
    };
    collection.insert(recordToInsert, function(err, data){
        if (err) {throw err}
        db.close();
        callback(null, recordToInsert);
    });
    
    });
}
function lookup(lookupObject, callback) {
    MongoClient.connect(process.env.MONGOLAB_URI, function(err, db) {
    assert.equal(null, err);
    console.log("Lookup: Connected correctly to server.");
    var collection = db.collection("url");
    collection.find(lookupObject).toArray(function(err, results) {
        if (err) {throw err}
        db.close();
        console.log('Lookup: callback');
        callback(null, results);
    });
    });
}
function lookupLongURL(longURL, callback) {
    var query = {'longURL': longURL};
    lookup(query, function(err, results){
        if (err) {throw err}
        if (! results.length) {callback(null, false)}
        else if (results.length == 1) {callback(null, results[0])}
        else {
            console.log("Warning: multiple longURL present", longURL);
            callback(null, results[0]);
        }
    });
}

function lookupShortURL(shortURL, callback) {
    var query = {'shortURL': shortURL};
    lookup(query, function(err, results) {
        if (err) {throw err}
        if (! results.length) {callback(null, false);}
        else if (results.length == 1) {callback(null, results[0])}
        else {
            console.log("Warning: multiple shortURL present", shortURL);
            callback(null, results[0]);
        }}
    );
}

function newURL(longURL, callback) {
    lookupLongURL(longURL, function(err, record) {
        if (err) {throw err}
        if (record) {
            console.log('A record already exists', record);
            callback(null, record);
        }
        else if(validURL.isWebUri(longURL)){
            console.log("Let's create a new record");
            insertURL(longURL, function(err, record) {
                if (err) {throw err}
                callback(null, record);
            })}
        else {
            console.log('invalid URL');
            callback(null, {'error': 'Not A Valid URI', 'longURL': '', 'shortURL': '', 'dateCreated': 0});
        }
})}
var server = http.createServer(function(req, res) {
    var path = url.parse(req.url).path;
    console.log(path);
    if (path.split("/")[1] == 'new') {
        console.log("Creating new URL / using existing shortURL", path.substring(5));
        newURL(path.substring(5), function(err, record){
            if (err) {throw err}
            res.writeHead(200, {'Content-Type': "application/json"});
            var answer = {
                'longURL': record.longURL,
                'shortURL': appURL + '/' + record.shortURL
            };
            res.end(JSON.stringify(answer));
        });
    }
    else if (path.length == 11)
    {
        console.log("This is a short URL, looking it up");
        lookupShortURL(path.substring(1), function(err, result) {
            if (err){ throw (err)}
            if (! result) {
                res.end(JSON.stringify({'error': 'No match found'}));
            }
            else {
                var answer = {
                'longURL': result.longURL,
                'shortURL': appURL + '/' + result.shortURL
            };
                res.end(JSON.stringify(answer));
            }
        });
    }
    else if (path == '/') {
        fs.readFile('./index.html', 'binary', function(err, file) {
            if(err) {
                res.end(err);
                throw err;
            }
          res.end(file, 'binary');
        });
    }
    else {
        res.end(JSON.stringify({'error': 'URL is not a new URL nor a shorted url'}));
    }
    
});
server.listen(process.env.PORT || 5000);
console.log("Server started");