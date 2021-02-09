enum WappstoValueTemplate {
    //% block="Temperature"
    Temperature,
    //% block="Light level"
    Light,
    //% block="Compass"
    Compass,
    //% block="Acceleration"
    Acceleration,
    //% block="Rotation"
    Rotation,
    //% block="Magnetometer"
    Magnetic,
    //% block="Number"
    Number,
    //% block="Latitude"
    Latitude,
    //% block="Longitude"
    Longitude,
    //% block="Sound level"
    SoundLevel,

}

enum WappstoTransmit {
    //% block="If changed"
    OnChange,
    //% block="When possible"
    ASAP,
}

/**
 * MakeCode extension for the Seluxit Wappsto:bit extension module.
 */
//% color="#1f324d" weight=90 icon="\uf213" block="Wappsto"
//% groups=['Data model', 'Wappsto basic flow', 'Wappsto:bit information', 'Wappsto:bit configuration']
namespace wappsto {
    let version = "1.0.0"
    let microbitConnected = false
    let bitName = "Wappsto:bit"
    let i2cDevice = 0x11
    let bufferSize = 200
    let handlers: any[] = []
    let model: {[index: string]: string}[] = []
    let oldValue: any[] = []
    let gpsLongitude: number = NaN;
    let gpsLatitude: number = NaN;
    let signal: number = 0;
    let connectionStatus: string = "";
    let connectionInfo: string = "";
    let wappstoTime: number = NaN;
    let wappstoUptime: number = NaN;
    let wappstoConnected: boolean = false;
    let queueFull: boolean = false;

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

    function connect(name: string): void {
        let json: {[index: string]: string} = {};

        if(microbitConnected) {
            if(name != bitName) {
                bitName = name;
                json["device"] = "1";
                json["name"] = name;
                json["version"] = version;
                writeToWappstobit(json);
            }
            return;
        }

        microbitConnected = true;
        bitName = name;
        control.inBackground(() => {
            while (true) {
                let bufr = pins.i2cReadBuffer(i2cDevice, 200, false);
                let i = 0;
                while (bufr[i] != 255 && i < 200) {
                    if (i > 0 && bufr[i] == 0x00 && bufr[i-1] !=0x00) {
                        let data = bufr.slice(0,i).toString();
                        receiveHandler(data+'\n');
                        break;
                    }
                    i++;
                }
                basic.pause(100);
            }
        });

        basic.pause(100)

        json["device"] = "1";
        json["name"] = name;
        json["version"] = version;
        writeToWappstobit(json);

        control.inBackground(() => {
            while (true) {
                writeCommand("info");
                basic.pause(5000);
            }
        });
    }

    function writeCommand(cmd: string): void {
        let json = {"command": cmd};
        writeToWappstobit(json);
    }

    function writeValueUpdate(device: number, value: number, data: string = null, behaviour: WappstoTransmit = WappstoTransmit.ASAP): void {
        if(behaviour == WappstoTransmit.OnChange) {
            if(data == oldValue[value]) {
                return
            }
            oldValue[value] = data
        }

        let json: {[index: string]: string} = {};
        json["device"] = device.toString();
        json["value"] = value.toString();
        json["data"] = data;
        writeToWappstobit(json);
    }

    function writeToWappstobit(json: {[index: string]: string}): void {
        if(!microbitConnected) {
            connect(bitName);
        }

        // await wappsto:bit sending queue (only) on events hitting wappsto
        while((json["data"] != null || json["command"] == "clean") && queueFull) {
            basic.pause(100);
        }

        let data: string = generateJSON(json);
        let buffer = toUTF8Buffer(data)

        basic.pause(50) // allow microbit i2c ring buffer to empty
        pins.i2cWriteBuffer(i2cDevice, buffer, false)
    }

    function toUTF8Buffer(str: string) {
        let utf8 = [];
        for (let i=0; i < str.length; i++) {
            let  charcode = str.charCodeAt(i);
            if (charcode < 0x80) utf8.push(charcode);
            else if (charcode < 0x800) {
                utf8.push(0xc0 | (charcode >> 6));
                utf8.push(0x80 | (charcode & 0x3f));
            }
            else if (charcode < 0xd800 || charcode >= 0xe000) {
                utf8.push(0xe0 | (charcode >> 12));
                utf8.push(0x80 | ((charcode>>6) & 0x3f));
                utf8.push(0x80 | (charcode & 0x3f));
            }
            // surrogate pair
            else {
                i++;
                // UTF-16 encodes 0x10000-0x10FFFF by
                // subtracting 0x10000 and splitting the
                // 20 bits of 0x0-0xFFFFF into two halves
                charcode = 0x10000 + (((charcode & 0x3ff)<<10)
                          | (str.charCodeAt(i) & 0x3ff));
                utf8.push(0xf0 | (charcode >>18));
                utf8.push(0x80 | ((charcode>>12) & 0x3f));
                utf8.push(0x80 | ((charcode>>6) & 0x3f));
                utf8.push(0x80 | (charcode & 0x3f));
            }
        }

        let buffer = pins.createBuffer(utf8.length + 1);
        buffer.setNumber(NumberFormat.UInt8LE, utf8.length, 0x00)
        for (let i = 0; i < utf8.length; i++) {
            buffer.setNumber(NumberFormat.UInt8LE, i, utf8[i])
        }

        return buffer;
    }

    function receiveHandler(data: string): void {
        let json = parseJSON(data);
        let keys = Object.keys(json);

        let val = json["data"];
        if(val != null) {
            if(json["device"] != "1") {
                return;
            }
            let index: number = parseInt(json["value"]);
            if(handlers[index] != null) {
                handlers[index](val);
            }
        } else {
            let tmp = 0;
            for(let i = 0; i < keys.length; i++) {
                switch(keys[i]) {
                    case "lon":
                        tmp = parseFloat(json["lon"]);
                        if(tmp != 0.0) {
                            gpsLongitude = tmp;
                        }
                        break;
                    case "lat":
                        tmp = parseFloat(json["lat"]);
                        if(tmp != 0.0) {
                            gpsLatitude = tmp;
                        }
                        break;
                    case "signal":
                        signal = parseInt(json["signal"]);
                        break;
                    case "status":
                        connectionStatus = json["status"];
                        break;
                    case "network":
                        connectionInfo = json["network"];
                        break;
                    case "ready":
                        let wappstoReady: boolean = parseInt(json["ready"]) == 1
                        if(wappstoReady && !wappstoConnected) {
                            wappstoConnected = true;
                            for(let i=0; i < model.length; i++) {
                                if(model[i]) {
                                    writeToWappstobit(model[i]);
                                }
                            }
                        } else if(!wappstoReady) {
                            wappstoConnected = false;
                        }

                        break;
                    case "queue_full":
                        queueFull = parseInt(json["queue_full"]) == 1
                        break;
                    case "utc_time":
                        wappstoTime = parseInt(json["utc_time"]);
                        break;
                    case "uptime":
                        wappstoUptime = parseInt(json["uptime"]);
                }
            }
        }
    }

    /**
     * Configure the name of your Micro:bit on Wappsto.
     * @param name The name of your Micro:bit
     */
    //% weight=80
    //% blockId="wapp_configure_name" block="setup the %name of your Micro:bit on Wappsto"
    //% name.defl="Name"
    //% group="Data model"
    export function configureName(name: string): void {
        connect(name);
    }

    /**
     * Configure a Wappsto value.
     * @param valueID The id of the value to send
     * @param name The name of the value as seen on Wappsto
     * @param type The type of the value as seen on Wappsto
     */
    //% weight=90
    //% blockId="wapp_configure_value"
    //% block="setup Wappsto Number Value %valueID with name %name as %type"
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    //% name.defl="MyValue"
    //% type.defl=WappstoValueTemplate.Number
    //% group="Data model"
    export function configureValue(valueID: number, name: string, type: WappstoValueTemplate): void {
        switch(type) {
            case WappstoValueTemplate.Temperature:
                configureNumberValue(valueID, name, "temperature", -5, 50, 1, "\u00B0C");
                break;
            case WappstoValueTemplate.Light:
                configureNumberValue(valueID, name, "light level", 0, 255, 1, "");
                break;
            case WappstoValueTemplate.Compass:
                configureNumberValue(valueID, name, "compass heading", 0, 360, 1, "\u00B0");
                break;
            case WappstoValueTemplate.Acceleration:
                configureNumberValue(valueID, name, "accceleration", -1024, 1024, 1, "mg");
                break;
            case WappstoValueTemplate.Rotation:
                configureNumberValue(valueID, name, "rotation", 0, 360, 1, "\u00B0");
                break;
            case WappstoValueTemplate.Magnetic:
                configureNumberValue(valueID, name, "magnetic force", -40, 40, 0.001, "\u00B5T");
                break;
            case WappstoValueTemplate.Number:
                configureNumberValue(valueID, name, "number", 0, 255, 1, "");
                break;
            case WappstoValueTemplate.Latitude:
                configureNumberValue(valueID, name, "latitude", -90, 90, 0.000001, "\u00B0N");
                break;
            case WappstoValueTemplate.Longitude:
                configureNumberValue(valueID, name, "longitude", -180, 180, 0.000001, "\u00B0E");
                break;
            case WappstoValueTemplate.SoundLevel:
                configureNumberValue(valueID, name, "sound level", 0, 255, 1, "");
                break;
        }
    }

    /**
     * Configure Wappsto number value.
     * @param valueID The id of the value to send
     * @param name The name of the value as seen on Wappsto
     * @param type The type of the value as seen on Wappsto
     * @param min The minimum value of the number
     * @param max The maximum value of the number
     * @param step The increment size of the number
     * @param unit The unit as seen on Wappsto
     */
    //% weight=90
    //% blockId="wapp_configure_number_value"
    //% block="setup Wappsto Number Value %valueID Name: %name Type: %type||Min: %min Max: %max Step: %step Unit: %unit"
    //% expandableArgumentMode="toggle"
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    //% name.defl="MyNumber" type.defl="number" min.defl=0 max.defl=255 step.defl=1
    //% advanced=true
    //% group="Data model"
    export function configureNumberValue(valueID: number, name: string, type: string, min: number = 0, max: number = 255, step: number = 1, unit: string = null): void {
        if(unit == null) unit = "";
        let json: {[index: string]: string} = {};
        json["device"] = "1";
        json["value"] = valueID.toString();
        json["name"] = name;
        json["type"] = type;
        json["min"] = min.toString();
        json["max"] = max.toString();
        json["step"] = step.toString();
        json["unit"] = unit;

        model[valueID] = json;
        writeToWappstobit(json);
    }

    /**
     * Configure Wappsto string value.
     * @param valueID The id of the string to send
     * @param name The name of the string value as seen on Wappsto
     * @param type The type of the string value as seen on Wappsto (optional)
     */
    //% weight=90
    //% blockId="wapp_configure_string_value"
    //% block="setup Wappsto String Value %valueID with name %name as type %type"
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    //% name.defl="MyString" type.defl="string"
    //% group="Data model"
    export function configureStringValue(valueID: number, name: string, type: string): void {
        let json: {[index: string]: string} = {};
        json["device"] = "1";
        json["value"] = valueID.toString();
        json["name"] = name;
        json["type"] = type;

        model[valueID] = json;
        writeToWappstobit(json);
    }

    /**
     * Send the state of a number value to Wappsto.
     * @param input The new value to send
     * @param valueID The id of the value to send
     * @param behaviour Default sending behaviour.
     */
    //% weight=65
    //% blockId="wapp_number_value" block="send number %input to Wappsto Number Value %valueID||%behaviour"
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    //% behaviour.defl=WappstoTransmit.OnChange
    //% group="Wappsto basic flow"
    export function sendNumberToWappsto(input: number, valueID: number, behaviour: WappstoTransmit = WappstoTransmit.OnChange): void {
        writeValueUpdate(1, valueID, input.toString(), behaviour);
    }

    /**
     * Send the state of a string value to Wappsto.
     * @param input The new value to send
     * @param valueID The id of the value to send
     * @param behaviour Default sending behaviour.
     */
    //% weight=60
    //% blockId="wapp_string_value" block="send string %input to Wappsto String Value %valueID||%behaviour"
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    //% behaviour.defl=WappstoTransmit.OnChange
    //% group="Wappsto basic flow"
    export function sendStringToWappsto(input: string, valueID: number, behaviour: WappstoTransmit = WappstoTransmit.OnChange): void {
        writeValueUpdate(1, valueID, input, behaviour);
    }

    /**
     * Event handler for Wappsto number events.
     * @param valueID The id of the number value to handle
     */
    //% blockID="wappsto_number_event"
    //% block="on Number Value %valueID received from Wappsto"
    //% weight=45
    //% draggableParameters
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    //% group="Wappsto basic flow"
    export function onNumberEvent(valueID: number, handler: (receivedNumber: number) => void) {
        let json: {[index: string]: string} = {};
        json["device"] = "1";
        json["value"] = valueID.toString();

        model[valueID] = json;
        writeToWappstobit(json);
        handlers[valueID] = handler;
    }

    /**
     * Event handler for Wappsto string events.
     * @param valueID The id of the string value to handle
     */
    //% blockID="wappsto_string_event"
    //% weight=40
    //% block="on String Value %valueID received from Wappsto"
    //% draggableParameters
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    //% group="Wappsto basic flow"
    export function onStringEvent(valueID: number, handler: (receivedString: string) => void) {
        let json: {[index: string]: string} = {};
        json["device"] = "1";
        json["value"] = valueID.toString();

        model[valueID] = json;
        writeToWappstobit(json);
        handlers[valueID] = handler;
    }

    /**
     * Send a clean command to Wappsto.
     */
    //% weight=40
    //% advanced=true
    //% blockId="wapp_clean" block="send request to clear Wappsto"
    //% group="Data model"
    export function sendCleanToWappsto(): void {
        writeCommand("clean");
    }

    /**
     * Input block returning the longitude of the Wappsto:bit. NaN if not available.
     */
    //% block="GPS longitude"
    //% group="Wappsto:bit information"
    export function longitude(): number {
        return gpsLongitude;
    }

    /**
     * Input block returning the latitude of the Wappsto:bit. NaN if not available.
     */
    //% block="GPS latitude"
    //% group="Wappsto:bit information"
    export function latitude(): number {
        return gpsLatitude;
    }

    /**
     * Input block returning the signal quality of the network link [0-100%].
     */
    //% block="Signal quality"
    //% group="Wappsto:bit information"
    //% advanced=true
    export function signalQuality(): number {
        return signal;
    }

    /**
     * Input block returning the network name of which the Wappsto:bit is connected to.
     */
    //% block="Network Name"
    //% group="Wappsto:bit information"
    //% advanced=true
    export function carrier(): string {
        return connectionInfo;
    }

    /**
     * Input block returning the Wappsto:bit UTC time in seconds.
     */
    //% block="UTC Time (UNIX timestamp)"
    //% group="Wappsto:bit information"
    //% advanced=true
    export function time(): number {
        return wappstoTime;
    }

    /**
     * Input block returning the Wappsto:bit uptime. I.e. time in seconds since last power cycle.
     */
    //% block="Wappsto:bit Uptime"
    //% group="Wappsto:bit information"
    //% advanced=true
    export function uptime(): number {
        return wappstoUptime;
    }

    /**
     * Conditional block returning a boolean flag to signal whether or not Wappsto:bit is fully connected and ready.
     */
    //% block="Wappsto:bit is online"
    //% group="Wappsto:bit information"
    export function connected(): boolean {
        return wappstoConnected;
    }

    /**
     * Configurere the SSID to which the Wappsto:bit connects when on Wi-Fi network.
     * @param ssid The SSID to connect to
     * @param password The Wi-Fi password
     */
    //% blockId="wapp_configure_wifi"
    //% block="configure Wifi network: %ssid %pass"
    //% ssid.defl="SSID" pass.defl="password"
    //% group="Wappsto:bit configuration"
    //% advanced=true
    export function configureWifi(ssid: string, pass: string): void {
        let json: {[index: string]: string} = {};
        json["command"] = "config_wifi";
        json["ssid"] = ssid;
        json["pass"] = pass;

        writeToWappstobit(json);
    }

    /**
     * Configurere the APN to which the Wappsto:bit connects when on cellular network.
     * @param apn The APN string
     */
    //% blockId="wapp_configure_apn"
    //% block="configure cellular APN: %apn"
    //% apn.defl="telenor.iot"
    //% group="Wappsto:bit configuration"
    //% advanced=true
    export function configureApn(apn: string): void {
        let json: {[index: string]: string} = {};
        json["command"] = "config_apn";
        json["apn"] = apn;

        writeToWappstobit(json);
    }
}
