const replace = (string, object) => string.replaceAll(/\{([^}]+)\}/gi, (_, a) => a.split('.').reduce((b, c) => b?.[c], object));

module.exports = {
    buildPlex () {
        return `
            <tr>
                <td><p>Plex Media Server</p></td>
                <td><p id="plex" class="off">Unknown</p></td>
                <td>NA</td>
                <td><button id="plex-button">Restart</button></td>
            </tr>`;
    },

    buildRow: function(name, id, type, port) {
        const row = `
            <tr>
                <td><p>{name}</p></td>
                <td><p id="{id}" class="off">Unknown</p></td>
                <td><p id="{id}-port">{port}</p></td>
                <td>
                    <form method="post">
                        <button id="{id}-restart" formaction="/service-restart?name={id}&service={type}">Restart</button>
                    </form><br>
                </td>
            </tr>`;

        let repl = {
            name: name,
            id: id,
            type: type,
            port: port
        };

        return replace(row, repl);
    },

    buildHeader: function(headers) {
        const headerCell = `
                <th>{header}</th>
        `;

        let ret = "";

        headers.forEach(header => {
            ret += replace(headerCell, { header: header });
        });

        return ret;
    },

    build: function (headers, rows) {
        let ret = "<table>\n<tr>";
        ret += this.buildHeader(headers);
        ret += "</tr>";

        ret += this.buildPlex();

        rows.forEach(row => {
            ret += this.buildRow(row.name, row.tag, row.type, row.port);
        });

        ret += "</table>";

        return ret;
    }
};