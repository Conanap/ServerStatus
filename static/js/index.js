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
        retStr += "Server statuses are updated live every 1 second.";

        document.querySelector('#curTime').innerHTML = retStr;
        setTimeout(updateTime, 1000);
    };

    // server statuses
    function updateMC() {
        console.log("Checking MC");
        api.mcStatus(function(status, err) {
            var ele = document.querySelector('#mc');
            if(err) {
                ele.innerHTML = 'Unknown';
                ele.className = 'off';
                return;
            }

            ele.innerHTML = status;
            if(status == 'Online')
                ele.className = "on";
            else
                ele.className = 'off';

        });
        setTimeout(updateMC, 1000);
    };

    function updatePlex() {
        console.log("Checking Plex");
        api.plexStatus(function(status, err) {
            var ele = document.querySelector('#plex');
            if(err) {
                ele.innerHTML = 'Unknown';
                ele.className = 'off';
                return;
            }

            ele.innerHTML = status;
            if(status == 'Online')
                ele.className = "on";
            else
                ele.className = 'off';

        });
        setTimeout(updatePlex, 1000);
    };

    updateTime();
    updateMC();
    updatePlex();
}());