enum WappstoCommand {
    //% block="Save"
    Save = 1,
    //% block="Clean"
    Clean = 2,
}

enum WappstoValueTemplate {
    //% block="Temperature"
    Temperature,
    //% block="Light"
    Light,
    //% block="Compass"
    Compass,
    //% block="Acceleration"
    Acceleration,

    Rotation,
    Magnetic,
    //% block="Number"
    Number,


}

/**
 * MakeCode extension for Wappsto NB-IoT module
 */
//% color=#03a6ef weight=90 icon="\uf213" block="Wappsto"
namespace Wappsto {
    let connected = false
    let link = "i2c"
    let i2cDevice = 0x11
    let bufferSize = 200
    let handlers: any[] = []

    function parseJSON(data: string): Array<any> {
        let res = ["","",""]
        if(data.indexOf("{") == 0 && data.indexOf("}") != -1) {
            data = data.replace("{","").replace("}","").replaceAll("\"","")
            let aData = data.split(",");
            for(let i=0; i < aData.length; i++) {
                let arr = aData[i].split(":");
                switch(arr[0]) {
                    case "device":
                        res[0] = arr[1]
                        break
                    case "value":
                        res[1] = arr[1]
                        break
                    case "data":
                        res[2] = arr[1];
                        break
                }
            }
        }
        return res;
    }

    function writeCommand(cmd: string): void {
        writeToWappstobit('{"command":"'+cmd+'"}');
    }

    function writeValueUpdate(device: number, value: number, data: string): void {
        writeToWappstobit('{"device":'+device.toString()+',"value":'+value.toString()+',"data":"'+data+'"}');
    }

    function writeToWappstobit(data: string): void {
        if(!connected) {
            connect();
        }
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
        basic.pause(100);
    }


    function receiveHandler(data: string): void {
        let j = parseJSON(data);
        let index: number = j[1]
        if(j[0] == 1) {
            if(handlers[index] != null) {
                handlers[index](j[2]);
            }
        }
    }


    /**
     * Connects to the Wappsto NB IoT Module
     */
    //% weight=100
    //% blockId="wapp_microbit_connect" block="connect to the Wappsto NB IoT Module"
    export function connect(): void {
        if(connected) {
            return;
        }

        connected = true;
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
                    for (let i=0; i<bufr.length; i++) {
                        if (bufr.getNumber(NumberFormat.Int8LE, i) == 0x00 && i > 0) {
                            let data = bufr.slice(0,i).toString();
                            receiveHandler(data)
                            serial.writeString('BitRx ('+data.length+'): ' + data+ '\n')
                            break;
                        }
                    }
                    basic.pause(100)
                }
            })
        }

        basic.pause(100)
    }

    /**
     * Configure wappsto device.
     * @param name The name of the device
     */
    //% weight=90
    //% blockId="wapp_configure_device" block="set Wappsto device name to %name"
    //% name.defl=MicroBit
    export function configureDevice(name: string): void {
        let device = 1;
        writeToWappstobit('{"device":'+device.toString()+',"name":"'+name+'"}')
    }

    /**
     * Configure a wappsto value.
     */
    //% weight=80
    //% blockId="wapp_configure_value"
    //% block="setup Wappsto value %valueID with name %name as %type"
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    //% name.defl="MyValue"
    export function configureValue(valueID: number, name: string, type: WappstoValueTemplate): void {
        switch(type) {
            case WappstoValueTemplate.Temperature:
                configureNumberValue(valueID, name, "Temperature", -5, 50, 1, "C°");
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
                configureNumberValue(valueID, name, "Number", 0, 255, 1, "number");
                break;
        }
    }

    /**
     * Configure wappsto number value.
     */
    //% weight=80
    //% blockId="wapp_configure_number_value"
    //% block="setup Wappsto number value %valueID Name: %name Type: %type Min: %min Max: %max Step: %step Unit: %unit"
    //% advanced=true
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    export function configureNumberValue(valueID: number, name: string, type: string, min: number, max: number, step: number, unit: string): void {
        let device = 1;
        let data = '"device":'+device.toString()+',"value":'+valueID.toString()+',';
        data += '"name":"'+name+'","type": "'+type+'",';
        data += '"min":'+min.toString()+',"max":'+max.toString()+',"step":'+step+',';
        data += '"unit":"'+unit+'"';
        writeToWappstobit('{'+data+'}');
    }

    /**
     * Configure wappsto string value.
     */
    //% weight=70
    //% blockId="wapp_configure_string_value"
    //% block="setup Wappsto string value %valueID Name: %name Type: %type"
    //% advanced=true
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    export function configureStringValue(valueID: number, name: string, type: string): void {
        let device = 1;
        let data = '"device":'+device.toString()+',"value":'+valueID.toString()+',';
        data += '"name":"'+name+'","type": "'+type+'"';
        writeToWappstobit('{'+data+'}');
    }

    /**
     * Send a command to Wappsto.
     * @param cmd The command to send to wappsto
     */
    //% weight=60
    //% blockId="wapp_command" block="Send command %cmd to Wappsto"
    export function sendCommandToWappsto(cmd: WappstoCommand): void {
        switch(cmd) {
            case WappstoCommand.Clean:
                writeCommand("clean");
                break;
            case WappstoCommand.Save:
                writeCommand("save");
                break;
        }
    }

    /**
     * Send the state of a number value to Wappsto.
     * @param input The new value to send
     * @param valueID The id of the value to send to
     */
    //% weight=50
    //% blockId="wapp_number_value" block="send number %input to Wappsto for Value %valueID"
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    export function sendNumberToWappsto(input: number, valueID: number): void {
        writeValueUpdate(1, valueID, input.toString())
    }

    /**
     * Send the state of a string value to Wappsto.
     * @param input The new value to send
     * @param valueID The id of the value to send to
     */
    //% weight=50
    //% blockId="wapp_string_value" block="send string %input to Wappsto for Value %valueID"
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    export function sendStringToWappsto(input: string, valueID: number): void {
        writeValueUpdate(1, valueID, input)
    }

    /**
     * Event handler for Wappsto number events.
     */
    //% blockID="wappsto_number_event"
    //% block="on number value %valueID received"
    //% draggableParameters
    //% advanced=true
    //% valueID.min=1 valueID.max=15 valueID.defl=1
    export function onNumberEvent(valueID: number, handler: (receviedNumber: number) => void) {
        handlers[valueID] = handler;
    }

    /**
     * Event handler for Wappsto string events.
     */
    //% blockID="wappsto_string_event"
    //% block="on string value %valueID received"
    //% draggableParameters
    //% advanced=true
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    export function onStringEvent(valueID: number, handler: (receviedString: string) => void) {
        handlers[valueID] = handler;
    }

}
