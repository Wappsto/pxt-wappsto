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
    let version: string = "1.0.7";
    let initialized: boolean = false;
    let deviceName: string = "Wappsto:bit";
    let i2cDevice: number = 0x11;
    let bufferSize: number = 256;
    let i2cChunkSize: number = 12;
    let handlers: any[] = [];
    let model: { [index: string]: string }[] = [];
    let oldValue: any[] = [];
    let gpsLongitude: number = NaN;
    let gpsLatitude: number = NaN;
    let signal: number = 0;
    let connectionStatus: string = "";
    let connectionInfo: string = "";
    let wappstoTime: number = NaN;
    let wappstoUptime: number = NaN;
    let wappstoConnected: boolean = false;
    let queueFull: boolean = false;

    /**
     * Create a empty JSON obj
     */
    function createJSON(): { [index: string]: string } {
        let res: { [index: string]: string } = {};
        return res;
    }

    /**
     * Convert string into JSON obj
     */
    function parseJSON(data: string): { [index: string]: string } {
        let res = createJSON();
        let start = data.indexOf("{");
        let end = data.indexOf("}");
        if(start != -1 && end != -1) {
            data = data.slice(start, end).replace("{","").replace("}","").replaceAll("\"","")
            let aData = data.split(",");
            for (let i = 0; i < aData.length; i++) {
                let arr: Array<string> = aData[i].split(":");
                res[arr[0]] = arr[1];
            }
        }
        return res;
    }

    /**
     * Convert JSON obj into string
     */
    function generateJSON(data: { [index: string]: string }): string {
        let json: string = "";
        let keys: string[] = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            if (json != "") {
                json += ",";
            }
            json += '"' + keys[i] + '":"' + data[keys[i]] + '"';
        }
        return '{' + json + '}';
    }

    /**
     * Setup communication with wappsto:bit
     */
    function initialize(name: string): void {
        if (initialized) {
            if (name != deviceName) {
                deviceName = name;
                sendDeviceToWappsto(deviceName);
            }
            return;
        }

        initialized = true;
        deviceName = name;
        if (wappstoConnected) {
            sendDeviceToWappsto(deviceName);
        }

        control.inBackground(() => {
            let readBuffer = pins.createBuffer(bufferSize);
            readBuffer.fill(0xff);
            let index = 0;
            while (true) {
                let bufr: Buffer = pins.i2cReadBuffer(i2cDevice, i2cChunkSize, false);
                if (bufr[0] == 0xff || (bufr[0] != 0x00 && bufr[1] == 0xff) || (bufr[0] == 0x00 && bufr[1] == 0x00)) {
                    //skip empty buffer and 1 byte garbage
                    basic.pause(100);
                    continue;
                }

                for (let i = 0; i < i2cChunkSize; i++) {
                    if (bufr[i] == 0xff) {
                        //break on no more data
                        break;
                    }
                    readBuffer.setNumber(NumberFormat.UInt8LE, index, bufr[i]);
                    index++;
                }

                while ( readBuffer[0] != 0xff ) {
                    let len = readBuffer.toString().indexOf("\0")
                    if (len < 0) {
                        //get more data
                        break;
                    }
                    if (len > 0) {
                        let data = readBuffer.slice(0, len).toString();
                        receiveHandler(data);
                    }

                    // shift buffer and fill with 0xff
                    readBuffer.shift(++len);
                    index -= len;
                    for (let i = bufferSize - len; i < bufferSize; i++) {
                        readBuffer.setNumber(NumberFormat.UInt8LE, i, 0xff);
                    }

                    //force scheduler to do context switch
                    basic.pause(0);
                }

                //force scheduler to do context switch
                basic.pause(0);
            }
        });

        control.inBackground(() => {
            while (true) {
                writeCommand("info");
                basic.pause(5000);
            }
        });

        basic.pause(100);
    }

    /**
     * Sends a command to wappsto:bit
     */
    function writeCommand(cmd: string): void {
        let json = createJSON();
        json["command"] = cmd;
        if (cmd == "info") {
            i2cWrite(json);
        } else {
            writeToWappstobit(json);
        }
    }

    /**
     * Send a value update, if value changed or if behaviour is ASAP
     */
    function writeValueUpdate(device: number, value: number, data: string = null,
        behaviour: WappstoTransmit = WappstoTransmit.ASAP): void {
        if (behaviour == WappstoTransmit.OnChange) {
            if (data == oldValue[value]) {
                return;
            }
            oldValue[value] = data;
        }

        let json = createJSON();
        json["device"] = device.toString();
        json["value"] = value.toString();
        json["data"] = data;
        writeToWappstobit(json);
    }

    /**
     * Send the message to wappsto:bit if we are connected and the queue is not full
     */
    function writeToWappstobit(json: { [index: string]: string }): void {
        initialize(deviceName);

        // If the message is a value update or a clean command
        if (json["data"] != null || json["command"] == "clean") {
            // Drop messages when wappsto:bit is not ready
            if (!wappstoConnected) {
                return;
            }
            // Wait untill queue is not full
            while (queueFull) {
                basic.pause(100);
            }
        }

        i2cWrite(json);
    }

    /**
     * Write JSON to the I2C bus
     */
    function i2cWrite(json: { [index: string]: string }): void {
        let data: string = generateJSON(json);
        let buffer: Buffer = toUTF8Buffer(data);

        // allow microbit i2c ring buffer to empty
        basic.pause(50);

        pins.i2cWriteBuffer(i2cDevice, buffer, false);
    }

    /**
     *Convert string into UTF8 buffer
     */
    function toUTF8Buffer(str: string): Buffer {
        let utf8: number[] = [];
        let i: number;
        for (i = 0; i < str.length; i++) {
            let charcode: number = str.charCodeAt(i);
            if (charcode < 0x80) {
                utf8.push(charcode);
            }
            else if (charcode < 0x800) {
                utf8.push(0xc0 | (charcode >> 6));
                utf8.push(0x80 | (charcode & 0x3f));
            }
            else if (charcode < 0xd800 || charcode >= 0xe000) {
                utf8.push(0xe0 | (charcode >> 12));
                utf8.push(0x80 | ((charcode >> 6) & 0x3f));
                utf8.push(0x80 | (charcode & 0x3f));
            }
            // surrogate pair
            else {
                i++;
                // UTF-16 encodes 0x10000-0x10FFFF by
                // subtracting 0x10000 and splitting the
                // 20 bits of 0x0-0xFFFFF into two halves
                charcode = 0x10000 + (((charcode & 0x3ff) << 10)
                    | (str.charCodeAt(i) & 0x3ff));
                utf8.push(0xf0 | (charcode >> 18));
                utf8.push(0x80 | ((charcode >> 12) & 0x3f));
                utf8.push(0x80 | ((charcode >> 6) & 0x3f));
                utf8.push(0x80 | (charcode & 0x3f));
            }
        }

        let buffer: Buffer = pins.createBuffer(utf8.length + 1);
        buffer.setNumber(NumberFormat.UInt8LE, utf8.length, 0x00);
        for (i = 0; i < utf8.length; i++) {
            buffer.setNumber(NumberFormat.UInt8LE, i, utf8[i]);
        }

        return buffer;
    }

    /**
     * Send device name to wappsto:bit
     */
    function sendDeviceToWappsto(name: string): void {
        let json = createJSON();

        json["device"] = "1";
        json["name"] = name;
        json["version"] = version;
        writeToWappstobit(json);
    }

    /**
     * Create a value on Wappsto
     */
     function createvalue(valueID: number, json: { [index: string]: string }) : void {
        model[valueID] = json;
        writeToWappstobit(json);
     }

    /**
     * Create a defualt value on Wappsto
     */
    function createDefaultValue(valueID: number): void {
        let json = createJSON();
        json["device"] = "1";
        json["value"] = valueID.toString();

        createvalue(valueID, json);
    }

    /**
     * Call "onChanged" handler if there is one registed for the value
     */
    function callHandler(index: number, val: string): void {
        if (handlers[index] != null) {
            // Run in thread to make sure that we do not block receive thread
            control.inBackground(() => {
                handlers[index](val);
            });
        }
    }

    /**
     * Send the current device and value configuration to wappsto:bit
     */
    function sendConfiguration(): void {
        // Run in thread to make sure that we do not block receive thread
        control.inBackground(() => {
            sendDeviceToWappsto(deviceName)
            for (let i: number = 0; i < model.length; i++) {
                if (model[i]) {
                    writeToWappstobit(model[i]);
                }
            }
        });
    }

    /**
     * Handle data received from the wappsto:bit
     */
    function receiveHandler(data: string): void {
        let json = parseJSON(data);
        let keys: string[] = Object.keys(json);
        let tmp: number = 0;
        let val: string = json["data"];

        if (val != null) {
            if (json["device"] != "1") {
                return;
            }
            let index: number = parseInt(json["value"]);
            callHandler(index, val);
            return;
        }

        for (let i: number = 0; i < keys.length; i++) {
            val = json[keys[i]];
            switch (keys[i]) {
                case "lon":
                    tmp = parseFloat(val);
                    if (tmp != 0.0) {
                        gpsLongitude = tmp;
                    }
                    break;
                case "lat":
                    tmp = parseFloat(val);
                    if (tmp != 0.0) {
                        gpsLatitude = tmp;
                    }
                    break;
                case "signal":
                    signal = parseInt(val);
                    break;
                case "status":
                    connectionStatus = val;
                    break;
                case "network":
                    connectionInfo = val;
                    break;
                case "queue_full":
                    queueFull = parseInt(val) == 1;
                    break;
                case "utc_time":
                    wappstoTime = parseInt(val);
                    break;
                case "uptime":
                    wappstoUptime = parseInt(val);
                    break;
                case "ready":
                    let wappstoReady: boolean = parseInt(val) == 1;
                    if (wappstoReady && !wappstoConnected) {
                        wappstoConnected = true;
                        sendConfiguration();
                    } else if (!wappstoReady) {
                        wappstoConnected = false;
                    }
                    break;
            }
        }
    }

    /**
     * Fail if the number is outside the range
     */
    function checkRange(x: number, min: number, max: number): void {
        if (x < min || x > max) {
            control.fail("ValueId " + x + " not in range " + min + "-" + max);
        }
    }

    /**
     * Configure the name of your Micro:bit on Wappsto.
     * @param name The name of your Micro:bit
     */
    //% weight=80
    //% blockId="wapp_configure_name" block="setup Micro:bit on Wappsto with name %name"
    //% name.defl="Name"
    //% group="Data model"
    export function configureName(name: string): void {
        initialize(name);
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
        switch (type) {
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
                configureNumberValue(valueID, name, "acceleration", -1024, 1024, 1, "mg");
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
    //% weight=95
    //% blockId="wapp_configure_number_value"
    //% block="setup Wappsto Number Value %valueID Name: %name Type: %type||Min: %min Max: %max Step: %step Unit: %unit"
    //% expandableArgumentMode="toggle"
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    //% name.defl="MyNumber" type.defl="number" min.defl=0 max.defl=255 step.defl=1
    //% advanced=true
    //% group="Data model"
    export function configureNumberValue(valueID: number, name: string, type: string, min: number = 0, max: number = 255, step: number = 1, unit: string = null): void {
        checkRange(valueID, 1, 15);
        if (unit == null) {
            unit = "";
        }
        let json = createJSON();
        json["device"] = "1";
        json["value"] = valueID.toString();
        json["name"] = name;
        json["type"] = type;
        json["min"] = min.toString();
        json["max"] = max.toString();
        json["step"] = step.toString();
        json["unit"] = unit;

        createvalue(valueID, json);
    }

    /**
     * Configure Wappsto string value.
     * @param valueID The id of the string to send
     * @param name The name of the string value as seen on Wappsto
     * @param type The type of the string value as seen on Wappsto (optional)
     */
    //% weight=94
    //% blockId="wapp_configure_string_value"
    //% block="setup Wappsto String Value %valueID with name %name as type %type"
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    //% name.defl="MyString" type.defl="string"
    //% group="Data model"
    export function configureStringValue(valueID: number, name: string, type: string): void {
        checkRange(valueID, 16, 20);

        let json = createJSON();
        json["device"] = "1";
        json["value"] = valueID.toString();
        json["name"] = name;
        json["type"] = type;

        createvalue(valueID, json);
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
        checkRange(valueID, 1, 15);
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
        checkRange(valueID, 16, 20);
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
        checkRange(valueID, 1, 15);

        // Create a value on Wappsto if it is not there, so that the user can control it
        createDefaultValue(valueID);

        // Save handler so we can call it later
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
        checkRange(valueID, 16, 20);

        // Create a value on Wappsto if it is not there, so that the user can control it
        createDefaultValue(valueID);

        // Save handler so we can call it later
        handlers[valueID] = handler;
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
        let json = createJSON();
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
        let json = createJSON();
        json["command"] = "config_apn";
        json["apn"] = apn;

        writeToWappstobit(json);
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
}
