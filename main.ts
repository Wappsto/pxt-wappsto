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

    function parseJSON(data: string): Array<any> {
        let res = ["", "","",""]
        if(data.indexOf("{") == 0 && data.indexOf("}") != -1) {
            data = data.replace("{","").replace("}","").replaceAll("\"","")
            let aData = data.split(",");
            if(aData[0].split(":")[0] == "device") {
                res[0]="wappsto"
                for(let i=0; i < aData.length; i++) {
                    let arr = aData[i].split(":");
                    switch(arr[0]) {
                        case "device":
                            res[1] = arr[1]
                            break
                        case "value":
                            res[2] = arr[1]
                            break
                        case "data":
                            res[3] = arr[1];
                            break
                    }
                }
            } else {
                serial.writeString(data + '\n')
            }
        }

        return res;
    }

    function writeCommand(cmd: string): void {
        writeToWappstobit('{"command":"'+cmd+'"}');
    }

    function writeValueUpdate(device: number, value: number, data: string = null): void {
        writeToWappstobit('{"device":'+device.toString()+',"value":'+value.toString()+',"data":"'+data+'"}');
    }

    function writeToWappstobit(data: string): void {
        if(!connected) {
            connect(bitName);
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
        //basic.pause(5000);
    }


    function receiveHandler(data: string): void {
        let j = parseJSON(data);
        switch (j[0]) {
            case "wappsto":
                let index: number = j[2]
                if(j[1] == 1) {
                    if(handlers[index] != null) {
                        handlers[index](j[3]);
                    }
                }
                break
            case "message":
                break
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
                            serial.writeString('BitRx ('+data.length+'): ' + data+ '\n')
                            receiveHandler(data+'\n')
                            break;
                        }
                        i++;
                    }

                    basic.pause(100)
                }
            });
        }

        basic.pause(100)
        //writeCommand("clean");
        writeToWappstobit('{"device":1,"name":"'+name+'"}')

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
        let device = 1;
        if(unit==null) unit = "";
        let data = '"device":'+device.toString()+',"value":'+valueID.toString()+',';
        data += '"name":"'+name+'","type": "'+type+'",';
        data += '"min":'+min.toString()+',"max":'+max.toString()+',"step":'+step+',';
        data += '"unit":"'+unit+'"';
//        model.push({"sent": false, "model": '{'+data+'}'});
        writeToWappstobit('{'+data+'}');
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
        let device = 1;
        let data = '"device":'+device.toString()+',"value":'+valueID.toString()+',';
        data += '"name":"'+name+'","type": "'+type+'"';
//        model.push({"sent": false, "model": '{'+data+'}'});
        writeToWappstobit('{'+data+'}');

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
       if(behaviour == WappstoTransmit.OnChange) {
            if(input == old_value[valueID]) {
                return
            }
            old_value[valueID] = input
        }

        writeValueUpdate(1, valueID, input.toString())
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
        if(behaviour == WappstoTransmit.OnChange) {
            if(input == old_value[valueID]) {
                return
            }
            old_value[valueID] = input
        }

        writeValueUpdate(1, valueID, input)
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
    //% draggableParameters
    //% advanced=true
    //% valueID.min=16 valueID.max=20 valueID.defl=16
    export function onStringEvent(valueID: number, handler: (receivedString: string) => void) {
        writeValueUpdate(1, valueID, "");
        handlers[valueID] = handler;
    }

    /**
     * Send a command to Wappsto.
     * @param cmd The command to send to wappsto
     */
    //% weight=60
    //% advanced=true
    //% blockId="wapp_command" block="send command %cmd to Wappsto"
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

    //% block="GPS longitude"
    export function longitude(): number {
        return 9.88369;
    }

    //% block="GPS latitude"
    export function latitude(): number {
        return 57.01971;
    }

    //% block="Signal quality"
    export function signalQuality(): number {
        return randint(98, 100);
    }

    //% block="Carrier"
    export function carrier(): string {
        return "TELENOR";
    }


}
