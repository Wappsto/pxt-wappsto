enum Sensor {
      //% block="temperature"
      Temperature = 1,
      //% block="light level"
      LightLevel = 2,
      //% block="compass heading"
      CompassHeading = 3

    }


/**
 * MakeCode extension for Wappsto NB-IoT module
 */
//% color=#03a6ef weight=90 icon="\uf213" block="Wappsto"
namespace Wappsto {
    let connected = false
    let device = 'microbit'


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
        serial.redirect(
            SerialPin.P8,
            SerialPin.P1,
            BaudRate.BaudRate115200
        )
        serial.setRxBufferSize(200)
        serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
            let data = serial.readLine();
            let j = parseJSON(data);
            if(j[0] == "microbit") {
                switch(j[1]) {
                    case "display":
                        basic.showString(j[2]);
                        break;
                }
            }
        });
        basic.pause(100)
    }

    function parseJSON(data: string): Array<string> {
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

    function writeToSerial(device: string, value: string, data: string): void {
        if(!connected) {
            connect()
        }
        serial.writeString('{"device":"'+device+'","value":"'+value+'","data":"'+data+'"}\n')
        basic.pause(100)
    }

    /**
     * Send the state of Button %button to Wappsto.
     * @param button Button, eg: "A"
     */
    //% weight=80
    //% blockId="wapp_button" block="send button %button to Wappsto"
    //% advanced=true
    export function sendButton(button: Button): void {
        let name = 'Button A'
        if(button == Button.B) {
            name = 'Button B'
        }
        writeToSerial(device, name, input.buttonIsPressed(button) ? "1" : "0")
    }

    /**
     * Send the value of Microbit Sensor %sensor to Wappsto.
     * @param sensor Sensor, eg: "Temperature"
     */
    //% weight=90
    //% blockId="wapp_microbit_value" block="send value of %sensor to Wappsto"
    export function sendMicrobitValue(sensor: Sensor): void {
        let name = null
        let value = null
        switch(sensor) {
            case Sensor.Temperature:
                name = 'temperature';
                value = input.temperature();
                break;
            case Sensor.LightLevel:
                name = 'light_level';
                value = input.lightLevel();
                break;
            case Sensor.CompassHeading:
                name = 'compass_heading';
                value = input.compassHeading();
                break;
        }
        sendToWappsto(value, device, name)
    }

    /**
     * Send the state of %input to Wappsto.
     */
    //% weight=100
    //% blockId="wapp_custom_value" block="send %input to Wappsto device %deviceName as %valueName"
    //% advanced=true
    export function sendToWappsto(input: number, deviceName: string, valueName: string): void {
        writeToSerial(deviceName, valueName, input.toString())
    }

    /**
     * A simple event taking an function handler
     */
    //% block="on control state update event"
    //% advanced=true
    export function onEvent(handler: () => void) {

    }

    /**
     * Event handler for Wappsto events. You can refer to them using $NAME.
     */
    //% block="on value $handlerArg1 change event"
    //% draggableParameters
    //% advanced=true
    export function onEventWithHandlerArgs(handler: (handlerArg: string) => void) {

    }

}
