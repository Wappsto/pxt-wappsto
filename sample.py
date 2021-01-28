from microbit import *

def wappstoWrite(json):
    i2c.write(0x11, json + '\0')

def wappstoRead():
    bufr = i2c.read(0x11, 200)
    for i in range(1, 200):
        if bufr[i] == 0xff:
            break
        if bufr[i] == 0x00 and bufr[i-1] != 0x00:
            return bufr[0:i]

# Configure name of device in Wappsto with optional version string
wappstoWrite('{"device":"1","name":"myMicro:bit",' +
             '"version":"myVersionString"}')

# Configure Number Value 1 in Wappsto Data Model as Temperature
wappstoWrite('{"device":"1","value":"1","name":"Temperature",' +
             '"type":"Temperature","min":"-5","max":"50",' +
             '"step":"1","unit":"°C"}')

# Sending a value update of Value ID 1 to Wappsto
wappstoWrite('{"device":"1","value":"1","data":"' +
             str(temperature()) + '"}')

# Reading from the Wappsto:bit, e.g. requesting Wappsto:bit info and returning
# the string length as a Wappsto Number Value ID 2
wappstoWrite('{"command":"info"}')

while True:
    jsonString = wappstoRead()
    if jsonString:
        wappstoWrite('{' +
                     '"device":"1","value":"2",' +
                     '"data":"' + str(len(jsonString)) + '"' +
                     '}')
        display.scroll(str(jsonString))
    sleep(1000)
