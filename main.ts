enum WappstoValueTemplate {
    //% block="Temperature"
    Temperature,
    //% block="Light"
    Light,
    //% block="Compass"
    Compass,
    //% block="Acceleration"
    Acceleration,
    //% block="Rotation"
    Rotation,
    //% block="Magnetic"
    Magnetic,
    //% block="Number"
    Number,
    //% block="Latitude"
    Latitude,
    //% block="Longitude"
    Longitude,
}

enum WappstoTransmit {
    //% block="OnChange"
    OnChange,
    //% block="ASAP"
    ASAP,
}

/**
 * MakeCode extension for the Seluxit Wappsto:bit extension module
 */
//% color=#03a6ef weight=90 icon="\uf213" block="Wappsto"
namespace Wappsto {
    let connected = false
    let bitName = "Wappsto:bit"
    let link = "i2c"
    let i2cDevice = 0x11
    let bufferSize = 200
    let handlers: any[] = []
    let model: { sent: boolean, model: string }[] = []
    let old_value: any[] = []
    let gps_longitude: number = 0;
    let gps_latitude: number = 0;
    let signal: number = 0;
    let connection_status: string = "";
    let connection_info: string = "";
    let _time_utc: number = 0;
    let _uptime: number = 0;
    let wappsto_connected: boolean = false;

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
            connection_status = json["status"];
            connection_info = json["network"];
            _time_utc = parseInt(json["utc_time"]);
            _uptime = parseInt(json["uptime"]);
            if(connection_status == "conencted") {
                wappsto_connected = true;
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
    //% name.defl=MicroBit
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

//        for(let i=0; i < model.length; i++) {
//            if(!model[i].sent) {
//                writeToWappstobit(model[i].model);
//                model[i].sent = true;
//            }
//        }
//
//        writeCommand("save");
    }

    /**
     * Configure a Wappsto value.
     */
    //% weight=90
    //% blockId="wapp_configure_value"
    //% block="setup Wappsto value %valueID with name %name as %type"
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    //% name.defl="MyValue"
    //% type.defl=WappstoValueTemplate.Number
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
    //% block="setup Wappsto number value %valueID Name: %name Type: %type||Min: %min Max: %max Step: %step Unit: %unit"
    //% expandableArgumentMode="toggle"
    //% advanced=true
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    //% name.defl="MyNumber" type.defl="Number" min.defl=0 max.defl=255 step.defl=1
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
        writeToWappstobit(json);
    }

    /**
     * Configure Wappsto string value.
     */
    //% weight=90
    //% blockId="wapp_configure_string_value"
    //% block="setup Wappsto string %valueID with name %name as type %type"
    //% advanced=true
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    //% name.defl="MyString" type.defl="String"
    export function configureStringValue(valueID: number, name: string, type: string): void {
        let json: {[index: string]: string} = {};
        json["device"] = "1";
        json["value"] = valueID.toString();
        json["name"] = name;
        json["type"] = type;
        writeToWappstobit(json);

    }

    /**
     * Send the state of a number value to Wappsto.
     * @param input The new value to send
     * @param valueID The id of the value to send
     */
    //% weight=50
    //% blockId="wapp_number_value" block="send number %input to Wappsto for Value %valueID||%behaviour"
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    //% behaviour.defl=WappstoTransmit.OnChange
    export function sendNumberToWappsto(input: number, valueID: number, behaviour: WappstoTransmit = WappstoTransmit.OnChange): void {
        writeValueUpdate(1, valueID, input.toString(), behaviour);
    }

    /**
     * Send the state of a string value to Wappsto.
     * @param input The new value to send
     * @param valueID The id of the value to send
     */
    //% weight=50
    //% blockId="wapp_string_value" block="send string %input to Wappsto for String %valueID||%behaviour"
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    //% behaviour.defl=WappstoTransmit.OnChange
    export function sendStringToWappsto(input: string, valueID: number, behaviour: WappstoTransmit = WappstoTransmit.OnChange): void {
        writeValueUpdate(1, valueID, input, behaviour);
    }

    /**
     * Event handler for Wappsto number events.
     */
    //% blockID="wappsto_number_event"
    //% block="on number value %valueID received from Wappsto"
    //% draggableParameters
    //% advanced=true
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    export function onNumberEvent(valueID: number, handler: (receivedNumber: number) => void) {
        writeValueUpdate(1, valueID, "");
        handlers[valueID] = handler;
    }

    /**
     * Event handler for Wappsto string events.
     */
    //% blockID="wappsto_string_event"
    //% block="on string value %valueID received from Wappsto"
    //% block.loc.da="når streng værdien %valueID modtages fra Wappsto"
    //% draggableParameters
    //% advanced=true
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    export function onStringEvent(valueID: number, handler: (receivedString: string) => void) {
        writeValueUpdate(1, valueID, "");
        handlers[valueID] = handler;
    }

    /**
     * Send a clean command to Wappsto.
     */
    //% weight=60
    //% advanced=true
    //% blockId="wapp_clean" block="send request to clear Wappsto"
    //% block.loc.da="fjern gamle værdier i Wappsto"
    export function sendCleanToWappsto(): void {
        writeCommand("clean");
    }

    //% block="GPS longitude"
    //% block.loc.da="GPS-længdegrad"
    export function longitude(): number {
        return gps_longitude;
    }

    //% block="GPS latitude"
    //% block.loc.da="GPS-breddegrad"
    export function latitude(): number {
        return gps_latitude;
    }

    //% block="Signal quality"
    //% block.loc.da="Signalstyrke"
    export function signalQuality(): number {
        return signal;
    }

    //% block="Network Name"
    //% block.loc.da="Netværksnavn"
    export function carrier(): string {
        return connection_info;
    }

    //% block="Time UTC (epoch seconds)"
    //% block.loc.da="Tid UTC (epoch sekunder)"
    export function time_utc(): number {
        return _time_utc;
    }

    //% block="Wappsto:bit Uptime"
    //% block.loc.da="Wappsto:bit oppetid"

    export function uptime(): number {
        return _uptime;
    }

    //% block="Wappsto:bit is online"
    //% block.loc.da="Wappsto:bit er online"
    export function wappstoConnected(): boolean {
        return wappsto_connected;
    }
}
