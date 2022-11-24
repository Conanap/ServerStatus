(function() {
    "use strict";

    function getUserTable() {

        api.getUsersList(function(list, err) {
            var ele = document.querySelector('#user_list_table');

            // header row
            let htmlstr = "<tr><th>Username</th><th>Email</th><th>Permissions</th></tr>";

            if(!err) {
                for (let index = 0; index < list.length; index++) {
                    htmlstr += "<tr><th>";
                    htmlstr += list[index].username;
                    htmlstr += "</th><th>";
                    htmlstr += list[index].email;
                    htmlstr += '</th><th>';
                    htmlstr += list[index].permission;
                    htmlstr += '</th></tr>';
                }
            }

            ele.innerHTML = htmlstr;
        });
    };

    getUserTable();
})();