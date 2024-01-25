// TODO: move these consts elsewhere so we can
// import into html
const DELAY = 10000;
(function() {
    "use strict";

    let months = {
        0: 'Jan',
        1: 'Feb',
        2: 'Mar',
        3: 'Apr',
        4: 'May',
        5: 'Jun',
        6: 'Jul',
        7: 'Aug',
        8: 'Sep',
        9: 'Oct',
        10: 'Nov',
        11: 'Dec'
    };

    let publicIP = undefined;

    function nums (input) {
        if(input < 10) {
            return '0' + input;
        } else
            return input;
    };

    function updateTime() {
        // Time string
        let date = new Date();
        let retStr = "Server statuses as of<br>" + date.getDate() + " " + months[date.getMonth()] + ", " + date.getFullYear() + " at " + nums(date.getHours()) + ":" + nums(date.getMinutes()) + ":" + nums(date.getSeconds()) + " EST<br>";
        retStr += date.getUTCDate() + " " + months[date.getUTCMonth()] + ", " + date.getUTCFullYear() + " at " + nums(date.getUTCHours()) + ":" + nums(date.getUTCMinutes()) + ":" + nums(date.getUTCSeconds()) + " UTC<br>";
        retStr += "Server statuses are updated live every 10 second.";

        document.querySelector('#curTime').innerHTML = retStr;
        setTimeout(updateTime, 1000);
    };

    function drawTable() {
        console.log("Getting table");
        api.getTable(function(tableStr, err) {
            var ele = document.querySelector("#actTable");
            if (err) {
                return;
            }

            ele.innerHTML = tableStr;
        });
    };

    function updateStatusWithType(apiFunc, type, tag, port = undefined) {
        apiFunc(type, port, function(status, err) {
            var ele = document.querySelector('#' + tag);
            if(err) {
                ele.innerHTML = 'Unknown';
                ele.className = 'off';
                return;
            }
            if(!ele) {
                console.log("No such element: " + tag + " for type " + type);
            }
    
            ele.innerHTML = status;
            if(status == 'Online')
                ele.className = "on";
            else
                ele.className = 'off';
        });
    };

    // server statuses
    function updateServers(servers) {
        console.log("Checking servers");

        servers.forEach(ele => {
            updateStatusWithType(api.getGenericServerStatus, ele.type, ele.tag, ele.port);
        });


        setTimeout(function() { updateServers(servers) }, DELAY);
    };

    function setServers() {
        api.getServers(function(serverList, err) {
            if (err) {
                console.log('Servers not set.');
                return;
            }
            console.log('Servers set.');

            updatePlex();
            updateServers(serverList);
        });
    };

    function updatePlex() {
        console.log("Checking Plex");
        updateStatusWithType(api.getGenericServerStatus, 'plex', 'plex');
        setTimeout(updatePlex, DELAY);
    };

    function updatePA() {
        console.log("Checking PAs");
        api.getPA(function(msgs, err) {
            var ele = document.querySelector("#PA");

            if(err) {
                ele.innerHTML = 'Cannot get PAs';
                return;
            }

            if(!Object.keys(msgs).length) {
                ele.innerHTML = '<p id="paholder">No new server announcements</p>';
                return;
            }

            let html = `
            <table>
                <tr>
                    <th>Message</th>
                    <th>Expiry Time</th>
                </tr>
            `;

            // ele.innerHTML = msgs;
            for(var msg in msgs) {
                html += "<tr><td>" + msgs[msg]["text"] + "</td>";
                let date = new Date(msgs[msg]["expiry"]);
                date = date.toUTCString().slice(0, -3) + "UTC";
                html += "<td>" + date + "</td><tr>";
            }
            html += "</table>";
            ele.innerHTML = html;
        });

        setTimeout(updatePA, DELAY);
    };

    function updatePublicIP() {
        console.log("Updating public IP");
        api.getLocIP(function(msgs, err) {
            if(err) {
                document.querySelector('#pubIP').innerHTML = '<p>Cannot get server IP</p>';
                return;
            }

            publicIP = msgs;
            document.querySelector('#pubIP').innerHTML = '<p>' + publicIP + '</p>';
        });

        setTimeout(updatePublicIP, DELAY);
    };

    drawTable();
    setServers();
    updateTime();
    updatePA();
    updatePublicIP();
}());