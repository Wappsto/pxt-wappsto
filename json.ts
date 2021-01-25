namespace Wappsto {
    function parseJSON(data: string): {[index: string]: string} {
        let res: {[index: string]: string} = {};
        if(data.indexOf("{") == 0 && data.indexOf("}") != -1) {
            data = data.replace("{","").replace("}","").replaceAll("\"","")
            let aData = data.split(",");
            for(let i=0; i < aData.length; i++) {
                let arr: Array<string> = aData[i].split(":");
                res[arr[0]] = arr[1];
            }
        }

        return res;
    }

    function generateJSON(data: {[index: string]: string}): string {
        let json: string = "";
        let keys = Object.keys(data);
        for(let i = 0; i < keys.length; i++) {
            if(json != "") {
                json += ",";
            }
            json += '"'+keys[i]+'":"'+data[keys[i]]+'"';
        }
        return '{'+json+'}';
    }
}
