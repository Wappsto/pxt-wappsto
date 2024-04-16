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

enum WappstoCommand {
    SetDeviceName,
    SetValueDefault,
    SetValueName,
    SetValueType,
    SetValueRangeMin,
    SetValueRangeMax,
    SetValueRangeStep,
    SetValueUnit,
    SetData,
    GetInfo,
    GetNetwork,
    GetLocation,
    SetWifi,
    SetApn,
    Clean,
    Save,
    Sleep,
}

enum WappstoResponse {
    ResponseError,
    ResponseCtrlData,
    ResponseInfo,
    ResponseInfoUptime,
    ResponseInfoUTC,
    ResponseInfoLoc,
}

const deviceId = 1;

const versionByteFormat = 2;
const HEADER_A = 0x42;
const HEADER_B = 0x21;

const BEGIN_TAG_A_INDEX   = 0;
const BEGIN_TAG_B_INDEX   = 1;
const VERSION_INDEX       = 2;
const REQ_LEN_INDEX       = 3;
const CRC_A_INDEX         = 4;
const CRC_B_INDEX         = 5;
const COMMAND_INDEX       = 6;

const REQ_HEADER_LEN        = 7;

const INFO_READY_INDEX      = 7;
const INFO_QUEUE_FULL_INDEX = 8;
const INFO_SIGNAL           = 9;
const INFO_VERSION_INDEX    = 10;


/**
 * MakeCode extension for the Seluxit Wappsto:bit extension module.
 */
//% color="#1f324d" weight=90 icon="\uf213" block="Wappsto"
//% groups=['Data model', 'Wappsto basic flow', 'Wappsto:bit information', 'Wappsto:bit configuration']
namespace wappsto {
    let initialized: boolean = false;
    let deviceName: string = "Wappsto:bit";
    let i2cDevice: number = 0x11;
    let bufferSize: number = 64;
    let handlers: any[] = [];
    let oldValue: any[] = [];
    let gpsLongitude: number = NaN;
    let gpsLatitude: number = NaN;
    let signal: number = 0;
    let connectionStatus: string = "";
    let wappstoTime: number = NaN;
    let wappstoUptime: number = NaN;
    let wappstoConnected: boolean = false;
    let queueFull: boolean = false;

    function handleInfo(ready: number, qF: number, rfSignal: number): void {
        signal = rfSignal;
        queueFull = (qF == 1);
        if ((ready == 1) && !wappstoConnected) {
            wappstoConnected = true;
            sendConfiguration();
        } else if (ready == 0) {
            wappstoConnected = false;
        }

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
            let index = 0;
            let res_id: WappstoResponse;
            let res_len: number;
            let tmp: number = 0;
            while (true) {
                let bufr: Buffer = pins.i2cReadBuffer(i2cDevice, bufferSize, false);

                if(bufr[0] == HEADER_A && bufr[1] == HEADER_B) {
                    res_id = bufr[COMMAND_INDEX];
                    res_len = bufr[REQ_LEN_INDEX];
                    switch(res_id) {
                    case WappstoResponse.ResponseError:
                        break;
                    case WappstoResponse.ResponseCtrlData:
                        let test:string = bufr.slice(REQ_HEADER_LEN+2, (res_len-REQ_HEADER_LEN-2)).toString();
                        let valId: number = bufr[REQ_HEADER_LEN+1];
                        callHandler(valId, test);
                        break;
                    case WappstoResponse.ResponseInfo:
                        handleInfo(bufr[INFO_READY_INDEX], bufr[INFO_QUEUE_FULL_INDEX], bufr[INFO_SIGNAL]);
                        break;
                    case WappstoResponse.ResponseInfoUptime:
                        handleInfo(bufr[INFO_READY_INDEX], bufr[INFO_QUEUE_FULL_INDEX], bufr[INFO_SIGNAL]);
                        wappstoUptime = parseInt(bufr.slice(INFO_VERSION_INDEX, res_len).toString());
                        break;
                    case WappstoResponse.ResponseInfoUTC:
                        handleInfo(bufr[INFO_READY_INDEX], bufr[INFO_QUEUE_FULL_INDEX], bufr[INFO_SIGNAL]);
                        wappstoTime = parseInt(bufr.slice(INFO_VERSION_INDEX, res_len).toString());
                        break;
                    case WappstoResponse.ResponseInfoLoc:
                        handleInfo(bufr[INFO_READY_INDEX], bufr[INFO_QUEUE_FULL_INDEX], bufr[INFO_SIGNAL]);
                        tmp = parseFloat(bufr.slice(INFO_VERSION_INDEX, 12).toString());
                        if (tmp != 0.0) {
                            gpsLatitude = tmp;
                        }
                        tmp = parseFloat(bufr.slice(INFO_VERSION_INDEX+12, 12).toString());
                        if (tmp != 0.0) {
                            gpsLongitude = tmp;
                        }
                        break;
                    default:
                        basic.pause(0);
                        continue;
                    }
                    bufr.fill(0xff);
                } else {
                    basic.pause(0);
                    continue;
                }
                //force scheduler to do context switch
                basic.pause(0);
            }
        });

        control.inBackground(() => {
            while (true) {
                writeBufferI2cDirect(WappstoCommand.GetInfo);
                basic.pause(5000);
            }
        });


        basic.pause(100);
    }


    function writeBufferI2cDirect(cmd: WappstoCommand): void {
        let writeBuffer = pins.createBuffer(REQ_HEADER_LEN);
        addHeader(writeBuffer, cmd, REQ_HEADER_LEN);
        basic.pause(50); // allow microbit i2c ring buffer to empty
        pins.i2cWriteBuffer(i2cDevice, writeBuffer, false);
    }

    function writeBufferI2c(writeBuffer: Buffer): void {
        initialize(deviceName);

        // Drop messages when wappsto:bit is not ready
        if (!wappstoConnected) {
            return;
        }
        // Wait untill queue is not full
        while (queueFull) {
            basic.pause(100);
        }

        basic.pause(50); // allow microbit i2c ring buffer to empty
        pins.i2cWriteBuffer(i2cDevice, writeBuffer, false);
    }


    function addHeader(buff: Buffer, command_id: WappstoCommand, msg_len: number): void {
        buff.setNumber(NumberFormat.UInt8LE, BEGIN_TAG_A_INDEX, HEADER_A);
        buff.setNumber(NumberFormat.UInt8LE, BEGIN_TAG_B_INDEX, HEADER_B);
        buff.setNumber(NumberFormat.UInt8LE, VERSION_INDEX, versionByteFormat);
        buff.setNumber(NumberFormat.UInt8LE, COMMAND_INDEX, command_id);
        buff.setNumber(NumberFormat.UInt16LE, CRC_A_INDEX, 0x4321);
        buff.setNumber(NumberFormat.UInt8LE, REQ_LEN_INDEX, msg_len);
    }

    /**
     * Sends a byte report data command to wappsto:bit
     */
    function writeReportData(device: number, value: number, data: string): void {

        let bufferLength = REQ_HEADER_LEN + 2 + (data.length*2) + 1;
        let writeBuffer = pins.createBuffer(bufferLength);

        addHeader(writeBuffer, WappstoCommand.SetData, bufferLength);

        writeBuffer.setNumber(NumberFormat.UInt8LE, REQ_HEADER_LEN, device)
        writeBuffer.setNumber(NumberFormat.UInt8LE, REQ_HEADER_LEN + 1, value);

        toUTF8BufferAppend(data, writeBuffer, REQ_HEADER_LEN + 2);

        writeBufferI2c(writeBuffer);
    }

    /**
     * Sends a byte set APN command to wappsto:bit
     */
    function writeApn(apn: string): void {
        let bufferLength = REQ_HEADER_LEN + 3 + apn.length;
        let writeBuffer = pins.createBuffer(bufferLength);

        addHeader(writeBuffer, WappstoCommand.SetApn, bufferLength);

        writeBuffer.setNumber(NumberFormat.UInt8LE, REQ_HEADER_LEN, apn.length);
        toUTF8BufferAppend(apn, writeBuffer, REQ_HEADER_LEN + 1);

        basic.pause(50); // allow microbit i2c ring buffer to empty
        pins.i2cWriteBuffer(i2cDevice, writeBuffer, false);

    }

    /**
     * Sends a byte set wifi/password command to wappsto:bit
     */
    function writeWifi(ssid: string, password: string): void {
        let bufferLength = REQ_HEADER_LEN + 3 + ssid.length + 1 + password.length;
        let writeBuffer = pins.createBuffer(bufferLength);
        addHeader(writeBuffer, WappstoCommand.SetWifi, bufferLength);

        writeBuffer.setNumber(NumberFormat.UInt8LE, REQ_HEADER_LEN, ssid.length);
        toUTF8BufferAppend(ssid, writeBuffer, REQ_HEADER_LEN + 1);
        writeBuffer.setNumber(NumberFormat.UInt8LE, REQ_HEADER_LEN + 1 + ssid.length, password.length);
        toUTF8BufferAppend(password, writeBuffer, REQ_HEADER_LEN + 2 + ssid.length);

        basic.pause(50); // allow microbit i2c ring buffer to empty
        pins.i2cWriteBuffer(i2cDevice, writeBuffer, false);
    }

    /**
     * Sends a byte simple command to wappsto:bit (no data)
     */
    function writeSimpleEnumCommand(cmd: WappstoCommand): void {
        switch(cmd) {
        case WappstoCommand.SetDeviceName:
        case WappstoCommand.SetValueName:
        case WappstoCommand.SetValueType:
        case WappstoCommand.SetValueRangeMin:
        case WappstoCommand.SetValueRangeMax:
        case WappstoCommand.SetValueRangeStep:
        case WappstoCommand.SetValueUnit:
        case WappstoCommand.SetData:
        case WappstoCommand.SetWifi:
        case WappstoCommand.SetApn:
            // Contain data
            return;
        case WappstoCommand.GetInfo:
            // must be handled seperately
            return;
        case WappstoCommand.Clean:
            writeBufferI2cDirect(WappstoCommand.Clean);
            return;
        case WappstoCommand.Save:
        case WappstoCommand.Sleep:
            // These are simple commands
            break;
        default:
            return;
        }
        let writeBuffer = pins.createBuffer(REQ_HEADER_LEN);
        addHeader(writeBuffer, cmd, REQ_HEADER_LEN);
        writeBufferI2c(writeBuffer);
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
        writeReportData(device, value, data);
    }

    /**
     *Convert string into UTF8 buffer
     */
    function toUTF8BufferAppend(str: string, buff: Buffer, offset: number): void {
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

        for (i = 0; i < utf8.length; i++) {
            buff.setNumber(NumberFormat.UInt8LE, offset+i, utf8[i]);
        }

    }

    /**
     * Send device name to wappsto:bit
     */
    function sendDeviceToWappsto(name: string): void {
        if (!wappstoConnected) {
            return;
        }
        let bufLength: number = (REQ_HEADER_LEN + 1 + name.length + 1);
        let writeBuffer = pins.createBuffer(bufLength);
        addHeader(writeBuffer, WappstoCommand.SetDeviceName, bufLength);
        writeBuffer.setNumber(NumberFormat.UInt8LE, REQ_HEADER_LEN, deviceId);
        toUTF8BufferAppend(name, writeBuffer, REQ_HEADER_LEN + 1);

        writeBufferI2c(writeBuffer);
    }

    /**
     * Create a defualt value on Wappsto
     */
    function createDefaultValue(valueID: number): void {
        let bufLength: number = (REQ_HEADER_LEN + 2);
        let writeBuffer = pins.createBuffer(bufLength);
        addHeader(writeBuffer, WappstoCommand.SetValueDefault, bufLength);
        writeBuffer.setNumber(NumberFormat.UInt8LE, REQ_HEADER_LEN, deviceId);
        writeBuffer.setNumber(NumberFormat.UInt8LE, REQ_HEADER_LEN + 1, valueID);

        writeBufferI2c(writeBuffer);
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
        });
    }

    /**
     * Fail if the number is outside the range
     */
    function checkRange(x: number, min: number, max: number): void {
        if (x < min || x > max) {
            control.fail("ValueId " + x + " not in range " + min + "-" + max);
        }
    }

    function createvalueStr(cmd: number, valueID: number, data: string): void {
        let bufLength: number = (REQ_HEADER_LEN + 2 + (data.length*2) + 1);
        let writeBuffer = pins.createBuffer(bufLength);
        addHeader(writeBuffer, cmd, bufLength);
        writeBuffer.setNumber(NumberFormat.UInt8LE, REQ_HEADER_LEN, deviceId);
        writeBuffer.setNumber(NumberFormat.UInt8LE, REQ_HEADER_LEN + 1, valueID);

        toUTF8BufferAppend(data, writeBuffer, REQ_HEADER_LEN + 2);
        writeBufferI2c(writeBuffer);
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
        while(!wappstoConnected) {
            basic.pause(500); // block setup till wappsto:bit is online
        }
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
                configureNumberValue(valueID, name, "number", -1e12, 1e12, 1, "");
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
    //% block="setup Wappsto Number Value %valueID Name: %name Type: %type Min: %min Max: %max Step: %step Unit: %unit"
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
        while(!wappstoConnected) {
            basic.pause(500); // block setup till wappsto:bit is online
        }
        createvalueStr(WappstoCommand.SetValueRangeMin, valueID, min.toString());
        createvalueStr(WappstoCommand.SetValueRangeMax, valueID, max.toString());
        createvalueStr(WappstoCommand.SetValueRangeStep, valueID, step.toString());
        createvalueStr(WappstoCommand.SetValueUnit, valueID, unit);
        createvalueStr(WappstoCommand.SetValueType, valueID, type);
        createvalueStr(WappstoCommand.SetValueName, valueID, name);
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

        while(!wappstoConnected) {
            basic.pause(500); // block setup till wappsto:bit is online
        }

        createvalueStr(WappstoCommand.SetValueType, valueID, type);
        createvalueStr(WappstoCommand.SetValueName, valueID, name);
    }

    /**
     * Send the state of a number value to Wappsto.
     * @param input The new value to send
     * @param valueID The id of the value to send
     * @param behaviour Default sending behaviour.
     */
    //% weight=65
    //% blockId="wapp_number_value" block="send number %input to Wappsto Number Value %valueID %behaviour"
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
    //% blockId="wapp_string_value" block="send string %input to Wappsto String Value %valueID %behaviour"
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
     * Configure the SSID to which the Wappsto:bit connects when on Wi-Fi network.
     * @param ssid The SSID to connect to
     * @param password The Wi-Fi password
     */
    //% blockId="wapp_configure_wifi"
    //% block="configure Wifi network: %ssid %pass"
    //% ssid.defl="SSID" pass.defl="password"
    //% group="Wappsto:bit configuration"
    //% advanced=true
    export function configureWifi(ssid: string, pass: string): void {
        writeWifi(ssid, pass);
    }

    /**
     * Configure the APN to which the Wappsto:bit connects when on cellular network.
     * @param apn The APN string
     */
    //% blockId="wapp_configure_apn"
    //% block="configure cellular APN: %apn"
    //% apn.defl="telenor.iot"
    //% group="Wappsto:bit configuration"
    //% advanced=true
    export function configureApn(apn: string): void {
        writeApn(apn);
    }

    /**
     * Put the Wappsto:bit in sleep mode.
     */
    //% weight=40
    //% advanced=true
    //% blockId="wapp_sleep" block="start sleep mode"
    //% group="Wappsto:bit configuration"
    export function commandSleep(): void {
        pins.digitalWritePin(wakePin, 0)
        writeSimpleEnumCommand(WappstoCommand.Sleep);
    }

    /**
     * Wake the Wappsto:bit from sleep mode.
     */
    //% weight=40
    //% advanced=true
    //% blockId="wapp_wake" block="wakeup from sleep"
    //% group="Wappsto:bit configuration"
    export function commandWake(): void {
        pins.digitalWritePin(wakePin, 1)
        basic.pause(100)
        pins.digitalWritePin(wakePin, 0)
    }


    /**
     * Send a clean command to Wappsto.
     */
    //% weight=40
    //% advanced=true
    //% blockId="wapp_clean" block="send request to clear Wappsto"
    //% group="Data model"
    export function sendCleanToWappsto(): void {
        writeSimpleEnumCommand(WappstoCommand.Clean);
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
