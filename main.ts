enum WappstoValueTemplate {
    //% block="Temperature"
    //% block.loc.da="Temperatur"
    Temperature,
    //% block="Light level"
    //% block.loc.da="Lys niveau"
    Light,
    //% block="Compass"
    //% block.loc.da="Kompas"
    Compass,
    //% block="Acceleration"
    //% block.loc.da="Acceleration"
    Acceleration,
    //% block="Rotation"
    //% block.loc.da="Rotation"
    Rotation,
    //% block="Magnetometer"
    //% block.loc.da="Magnetometer"
    Magnetic,
    //% block="Number"
    //% block.loc.da="Nummer"
    Number,
    //% block="Latitude"
    //% block.loc.da="Breddegrad"
    Latitude,
    //% block="Longitude"
    //% block.loc.da="Længdegrad"
    Longitude,
}

enum WappstoTransmit {
    //% block="If changed"
    //% block.loc.da="Hvis ændret"
    OnChange,
    //% block="When possible"
    //% block.loc.da="Når muligt"
    ASAP,
}

/**
 * MakeCode extension for the Seluxit Wappsto:bit extension module
 */
//% color=#1f324d weight=90 icon="\uf213" block="Wappsto"
//% groups=['Data model', 'Wappsto basic flow', "Wappsto:bit information", "Wappsto:bit configuration" 'others']

namespace Wappsto {
    let connected = false
    let bitName = "Wappsto:bit"
    let link = "i2c"
    let i2cDevice = 0x11
    let bufferSize = 200
    let handlers: any[] = []
    let model: {[index: string]: string}[] = []
    let old_value: any[] = []
    let gps_longitude: number = NaN;
    let gps_latitude: number = NaN;
    let signal: number = 0;
    let connection_status: string = "";
    let connection_info: string = "";
    let _time_utc: number = NaN;
    let _uptime: number = NaN;
    let wappsto_connected: boolean = false;
    let queueFull: boolean = false;

    function writeCommand(cmd: string): void {
        let json = {"command": cmd};
        writeToWappstobit(json);
    }

    function writeValueUpdate(device: number, value: number, data: string = null, behaviour: WappstoTransmit = WappstoTransmit.ASAP): void {
        if(behaviour == WappstoTransmit.OnChange) {
            if(data == old_value[value]) {
                return
            }
            old_value[value] = data
        }

        let json: {[index: string]: string} = {};
        json["device"] = device.toString();
        json["value"] = value.toString();
        json["data"] = data;
        writeToWappstobit(json);
    }

    function writeToWappstobit(json: {[index: string]: string}): void {
        if(!connected) {
            connect(bitName);
        }

        while(queueFull) {
            basic.pause(100);
        }

        let data: string = generateJSON(json);

        if(link=="serial") {
            serial.writeString(data+'\n');
        } else if(link=="i2c") {
            let buffer = pins.createBuffer(data.length + 1);
            buffer.setNumber(NumberFormat.UInt8LE, data.length, 0x00)
            for (let i = 0; i < data.length; i++) {
                buffer.setNumber(NumberFormat.UInt8LE, i, data.charCodeAt(i))
            }
            serial.writeString('BitTx ('+buffer.length+'): '+data+'\n')
            pins.i2cWriteBuffer(i2cDevice, buffer, false)
        }
    }

    function receiveHandler(data: string): void {
        let json = parseJSON(data);
        let val = json["data"];
        if(val != null) {
            if(json["device"] != "1") {
                return;
            }
            let index: number = parseInt(json["value"]);
            if(handlers[index] != null) {
                handlers[index](val);
            }
        } else if(Object.keys(json).length !== 0) {
            gps_longitude = parseFloat(json["lon"]);
            gps_latitude = parseFloat(json["lat"]);
            signal = parseInt(json["signal"]);
            let connection_status: string = json["status"] || "";
            let connection_info: string = json["network"] || "";
            let wappstoReady: boolean = parseInt(json["ready"]) == 1
            queueFull = parseInt(json["queue_full"]) == 1
            _time_utc = parseInt(json["utc_time"]);
            _uptime = parseInt(json["uptime"]);
            if(wappstoReady) {
                if (!wappsto_connected) {
                    wappsto_connected = true;
                    for(let i=0; i < model.length; i++) {
                        if(model[i]) {
                            writeToWappstobit(model[i]);
                        }
                    }
                }
            } else {
                wappsto_connected = false;
            }
        }
    }

    /**
     * Connects to Wappsto using Wappsto:bit
     * @param name The name of your Micro:bit
     */
    //% weight=80
    //% blockId="wapp_microbit_connect" block="connect %name to Wappsto by Seluxit"
    //% block.loc.da="forbind %name til Wappsto"
    //% name.defl=MicroBit
    //% group="Wappsto basic flow"
    export function connect(name: string): void {
        if(connected) {
            return;
        }

        connected = true;
        bitName = name;
        if(link=="serial") {
            serial.redirect(
                SerialPin.P8,
                SerialPin.P16,
                BaudRate.BaudRate115200
            )
            serial.setRxBufferSize(200)
            serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
                let data = serial.readLine();
                receiveHandler(data)
            });
        } else if(link=="i2c") {
            control.inBackground(() => {
                while (true) {
                    let bufr = pins.i2cReadBuffer(i2cDevice, 200, false);
                    let i = 0;
                    while (bufr[i] != 255 && i < 200) {
                        if (i > 0 && bufr[i] == 0x00 && bufr[i-1] !=0x00) {
                            let data = bufr.slice(0,i).toString();
                            serial.writeString('BitRx ('+data.length+'): ' + data+ '\n');
                            receiveHandler(data+'\n');
                            break;
                        }
                        i++;
                    }
                    basic.pause(100);
                }
            });
        }

        basic.pause(100)

        let json: {[index: string]: string} = {};
        json["device"] = "1";
        json["name"] = name;
        writeToWappstobit(json);

        //writeCommand("clean");

        control.inBackground(() => {
            while (true) {
                writeCommand("info");
                basic.pause(5000);
            }
        });
    }

    /**
     * Configure a Wappsto value.
     */
    //% weight=90
    //% blockId="wapp_configure_value"
    //% block="setup Wappsto Number Value %valueID with name %name as %type"
    //% block.loc.da="opsæt Wappsto Nummer Værdi %valueID med navn %name som %type"
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    //% name.defl="MyValue"
    //% type.defl=WappstoValueTemplate.Number
    //% group="Data model"

    export function configureValue(valueID: number, name: string, type: WappstoValueTemplate): void {
        switch(type) {
            case WappstoValueTemplate.Temperature:
                configureNumberValue(valueID, name, "Temperature", -5, 50, 1, "°C");
                break;
            case WappstoValueTemplate.Light:
                configureNumberValue(valueID, name, "Light", 0, 255, 1, "lx");
                break;
            case WappstoValueTemplate.Compass:
                configureNumberValue(valueID, name, "Compass", 0, 360, 1, "°");
                break;
            case WappstoValueTemplate.Acceleration:
                configureNumberValue(valueID, name, "Acceleration", -1024, 1024, 1, "mg");
                break;
            case WappstoValueTemplate.Rotation:
                configureNumberValue(valueID, name, "Rotation", 0, 360, 1, "°");
                break;
            case WappstoValueTemplate.Magnetic:
                configureNumberValue(valueID, name, "Magnetic Force", -40, 40, 0.001, "µT");
                break;
            case WappstoValueTemplate.Number:
                configureNumberValue(valueID, name, "Number", 0, 255, 1, "");
                break;
            case WappstoValueTemplate.Latitude:
                configureNumberValue(valueID, name, "latitude", -90, 90, 0.000001, "°N");
                break;
            case WappstoValueTemplate.Longitude:
                configureNumberValue(valueID, name, "longitude", -180, 180, 0.000001, "°E");
                break;
        }
    }

    /**
     * Configure Wappsto number value.
     */
    //% weight=90
    //% blockId="wapp_configure_number_value"
    //% block="setup Wappsto Number Value %valueID Name: %name Type: %type||Min: %min Max: %max Step: %step Unit: %unit"
    //% block.loc.da="opsæt Wappsto Nummer Værdi %valueID Navn: %name Type: %type||Min: %min Maks: %max Trin: %step Enhed: %unit"
    //% expandableArgumentMode="toggle"
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    //% name.defl="MyNumber" type.defl="Number" min.defl=0 max.defl=255 step.defl=1
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
     */
    //% weight=90
    //% blockId="wapp_configure_string_value"
    //% block="setup Wappsto String Value %valueID with name %name as type %type"
    //% block.loc.da="opsæt Wappsto Streng Værdi %valueID med navn %name som type %type"
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    //% name.defl="MyString" type.defl="String"
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
     */
    //% weight=65
    //% blockId="wapp_number_value" block="send number %input to Wappsto Number Value %valueID||%behaviour"
    //% block.loc.da="send nummer %input til Wappsto for Nummer Værdi %valueID||%behaviour"
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
     */
    //% weight=60
    //% blockId="wapp_string_value" block="send string %input to Wappsto String Value %valueID||%behaviour"
    //% block.loc.da="send strengen %input til Wappsto Streng Værdi %valueID||%behaviour"
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    //% behaviour.defl=WappstoTransmit.OnChange
    //% group="Wappsto basic flow"
    export function sendStringToWappsto(input: string, valueID: number, behaviour: WappstoTransmit = WappstoTransmit.OnChange): void {
        writeValueUpdate(1, valueID, input, behaviour);
    }

    /**
     * Event handler for Wappsto number events.
     */
    //% blockID="wappsto_number_event"
    //% block="on Number Value %valueID received from Wappsto"
    //% weight=45
    //% block.loc.da="når Nummer Værdien %valueID modtages fra Wappsto"
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
     */
    //% blockID="wappsto_string_event"
    //% weight=40
    //% block="on String Value %valueID received from Wappsto"
    //% block.loc.da="når Streng Værdien %valueID modtages fra Wappsto"
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
    //% block.loc.da="fjern gamle værdier i Wappsto"
    //% group="Data model"
    export function sendCleanToWappsto(): void {
        writeCommand("clean");
    }

    //% block="GPS longitude"
    //% group="Wappsto:bit information"
    //% block.loc.da="GPS-længdegrad"
    export function longitude(): number {
        return gps_longitude;
    }

    //% block="GPS latitude"
    //% group="Wappsto:bit information"
    //% block.loc.da="GPS-breddegrad"
    export function latitude(): number {
        return gps_latitude;
    }

    //% block="Signal quality"
    //% block.loc.da="Signalstyrke"
    //% group="Wappsto:bit information"
    //% advanced=true
    export function signalQuality(): number {
        return signal;
    }

    //% block="Network Name"
    //% block.loc.da="Netværksnavn"
    //% group="Wappsto:bit information"
    //% advanced=true
    export function carrier(): string {
        return connection_info;
    }

    //% block="UTC Time (UNIX timestamp)"
    //% block.loc.da="UTC-tid (UNIX tidsstempel)"
    //% group="Wappsto:bit information"
    //% advanced=true
    export function time_utc(): number {
        return _time_utc;
    }

    //% block="Wappsto:bit Uptime"
    //% block.loc.da="Wappsto:bit oppetid"
    //% group="Wappsto:bit information"
    //% advanced=true
    export function uptime(): number {
        return _uptime;
    }

    //% block="Wappsto:bit is online"
    //% group="Wappsto:bit information"
    //% block.loc.da="Wappsto:bit er online"
    export function wappstoConnected(): boolean {
        return wappsto_connected;
    }

    //% blockId="wapp_configure_wifi"
    //% block="configure Wifi network: %ssid %pass"
    //% block.loc.da="konfigurer Wifi netværk: %ssid %pass"
    //% ssid.defl="SSID" pass.defl="key"
    //% group="Wappsto:bit configuration"
    //% advanced=true
    export function configure_wifi(ssid: string, pass: string): void {
        let json: {[index: string]: string} = {};
        json["command"] = "config_wifi";
        json["ssid"] = ssid;
        json["pass"] = pass;

        writeToWappstobit(json);
    }

    //% blockId="wapp_configure_apn"
    //% block="configure cellular APN: %apn"
    //% block.loc.da="konfigurer mobilnetværk APN: %apn"
    //% apn.defl="telenor.iot"
    //% group="Wappsto:bit configuration"
    //% advanced=true
    export function configure_apn(apn: string): void {
        let json: {[index: string]: string} = {};
        json["command"] = "config_apn";
        json["apn"] = apn;

        writeToWappstobit(json);
    }
}
