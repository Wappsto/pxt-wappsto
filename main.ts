/**
 * MakeCode extension for Wappsto NB-IoT module
 */
//% color=#009b5b weight=90 icon="\uf1eb" block="Wappsto"
namespace Wappsto {
    let connected = false
    let device = 'microbit'

    /**
     * Connect to NB IoT
     */
    export function connect(): void {
        serial.redirect(
            SerialPin.P16,
            SerialPin.P8,
            BaudRate.BaudRate115200
        )
        basic.pause(100)
    }

    function writeToSerial(device: string, value: string, data: string): void {
        if(!connected) {
            connect()
        }
        serial.writeString('{"device":"'+device+'","value":"'+value+'","data":"'+data+'"}')
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
     * Send the state of the Temperature sensor to Wappsto.
     */
    //% weight=100
    //% blockId="wapp_temperature" block="send temperature to Wappsto"
    export function sendTemperature(): void {
        writeToSerial(device, 'temperature', input.temperature().toString())
    }


}
