(function() {
    "use strict";

    function getApprovalTable() {

        api.getApprovalList(function(list, err) {
            var ele = document.querySelector('#approval_table');

            // header row
            let htmlstr = "<tr><th>Username</th><th>Email</th><th>Action</th></tr>";

            if(!err) {
                for (let index = 0; index < list.length; index++) {
                    htmlstr += "<tr><th>";
                    htmlstr += list[index].username;
                    htmlstr += "</th><th>";
                    htmlstr += list[index].email;
                    htmlstr += '</th><th><a href="/user-approve?user=';
                    htmlstr += list[index].username;
                    htmlstr += '">Approve</a> / <a href="/user-deny?user=';
                    htmlstr += list[index].username;
                    htmlstr += '">Deny</a></th></tr>';
                }
            }

            ele.innerHTML = htmlstr;
        });
    };

    getApprovalTable();
})();