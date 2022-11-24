let api = (function() {
    "use strict";

    function send(method, url, data, callback){
        let xhr = new XMLHttpRequest();
        xhr.onload = function() {
            if (xhr.status !== 200) callback("[" + xhr.status + "]" + xhr.responseText, null);
            else callback(null, JSON.parse(xhr.responseText));
        };
        xhr.open(method, url, true);
        if (!data) xhr.send();
        else{
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(data));
        }
    }

    let module = {};

    module.mcStatus = function (listener) {
        send('GET', '/statuses/mc', {}, function(err, res) {
            listener(res, err ? true : false);
        });
    };

    module.plexStatus = function(listener) {
        send('GET', '/statuses/plex', {}, function(err, res) {
            listener(res, err ? true : false);
        });
    };

    module.getPA = function(listener) {
        send('GET', '/pa', {}, function(err, res) {
            listener(res, err ? true : false);
        });
    };

    module.getLocIP = function(listener) {
        send('GET', '/LocIP', {}, function(err, res) {
            listener(res, err ? true : false);
        });
    };

    module.getApprovalList = function(listener) {
        send('GET', '/approval-list', {}, function(err, res) {
            listener(res, err ? true: false);
        });
    };

    return module;
}());