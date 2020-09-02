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
     * Connect to NB IoT
     */
    export function connect(): void {
        serial.redirect(
            SerialPin.P8,
            SerialPin.P1,
            BaudRate.BaudRate115200
        )
        basic.pause(100)
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
    //% weight=100
    //% blockId="wapp_button" block="send button %button to Wappsto"
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
    //% weight=100
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
