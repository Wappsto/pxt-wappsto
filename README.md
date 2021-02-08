# Wappsto:bit [![Build Status](https://travis-ci.com/Wappsto/pxt-wappsto.svg?branch=master)](https://travis-ci.com/Wappsto/pxt-wappsto)

This is the Micro:bit extension for Wappsto:bit by Seluxit.
Wappsto:bit is a module that lets you connect your microbit to the Internet in an easy and intuitive way.
Drag in the blocks in makecode and data is available on wappsto.com in a dashboard right away.
The Wappsto mobile App allows for both viewing data and controlling your micro:bit from the Internet.

Wappsto:bit comes in 3 configurations:
* Wappsto:bit Basic (Wifi connectivity)
* Wappsto:bit NB-IoT (Wifi, 5G NB-IoT connectivity)
* Wappsto:bit NB-IoT+ (Wifi, 5G NB-IoT connectivity and GPS location)

## Getting started
* Getting started video: https://www.youtube.com/watch?v=GCt_CLVkZNs
* Getting started page: https://www.seluxit.com/wappstobit
* Product page: https://www.seluxit.com/iot-products/slx-wappstobit/

### Example

```blocks
// Configure adv settings
wappsto.configureWifi("ssid", "passsword");
wappsto.configureApn("new apn");

// Clean old data model
wappsto.sendCleanToWappsto();

// Configure Data model
wappsto.configureName("MyBit");
wappsto.configureValue(1, "Light Value", WappstoValueTemplate.Light);
wappsto.configureNumberValue(2, "Test Value", "Test", 0, 100, 1, "none");
wappsto.configureStringValue(15, "Test String Value", "Test");

// Register event handlers
wappsto.onNumberEvent(2, (num) => {
    basic.showNumber(num);
});
wappsto.onStringEvent(15, (str) => {
    basic.showString(str);
});

basic.showIcon(IconNames.No);

// Wait for connecting
while(!wappsto.connected()) {
    basic.pause(100);
}
basic.showIcon(IconNames.Yes);
basic.pause(1000);

// Send updates to Wappsto
wappsto.sendNumberToWappsto(1, input.lightLevel(), WappstoTransmit.OnChange);
wappsto.sendStringToWappsto("Hello From Wappsto:Bit", 15, WappstoTransmit.ASAP);

// Read data from Wappsto:bit
basic.showString("GPS");
let lon = wappsto.longitude();
let lat = wappsto.latitude();
if (lat == 0 && lon == 0) {
    basic.showString("NO");
} else {
    basic.showNumber(lon);
    basic.showNumber(lat);
}
basic.clearScreen();
basic.pause(1000);

if(wappsto.signalQuality() > 30) {
    basic.showString("Good signal");
} else {
    basic.showString("Bad signal");
}
basic.pause(3000);

basic.showString(wappsto.carrier());
basic.pause(3000);

basic.showNumber(wappsto.time());
basic.pause(1000);
basic.showNumber(wappsto.uptime());
```



## Reference

### configure name

Configure the name of your Micro:bit on Wappsto.

```sig
wappsto.configureName("name")
```

### configure value

Configure a Wappsto value.

```sig
wappsto.configureValue(1, "value name", WappstoValueTemplate.Temperature)
```

### configure number value

Configure Wappsto number value.

```sig
wappsto.configureNumberValue(1, "value name", "type", 0, 1, 1, "unit")
```

### configure string value

Configure Wappsto string value.

```sig
wappsto.configureStringValue(1, "value name", "type")
```

### send number to wappsto

Send the state of a number value to Wappsto.

```sig
wappsto.sendNumberToWappsto(1, 1, WappstoTransmit.OnChange)
```

### send string to wappsto

Send the state of a string value to Wappsto.

```sig
wappsto.sendStringToWappsto("value", 15, WappstoTransmit.OnChange)
```

### on number event

Event handler for Wappsto number events.

```sig
wappsto.onNumberEvent(1, (num) => {
    basic.showNumber(num)
});
```

### on string event

Event handler for Wappsto string events.

```sig
wappsto.onStringEvent(1, (str) => {
    basic.showString(str)
});
```

### send clean to wappsto

Send a clean command to Wappsto.

```sig
wappsto.sendCleanToWappsto()
```

### longitude

Input block returning the longitude of the Wappsto:bit. NaN if not available.

```sig
wappsto.longitude()
```

### latitude

Input block returning the latitude of the Wappsto:bit. NaN if not available.

```sig
wappsto.latitude()
```

### signal quality

Input block returning the signal quality of the network link [0-100%].

```sig
wappsto.signalQuality()
```

### carrier

Input block returning the network name of which the Wappsto:bit is connected to.

```sig
wappsto.carrier()
```

### time

Input block returning the Wappsto:bit UTC time in seconds.

```sig
wappsto.time()
```

### uptime

Input block returning the Wappsto:bit uptime. I.e. time in seconds since last power cycle.

```sig
wappsto.uptime()
```

### connected

Conditional block returning a boolean flag to signal whether or not Wappsto:bit is fully connected and ready.

```sig
wappsto.connected()
```

### configure wifi

Configurere the SSID to which the Wappsto:bit connects when on Wi-Fi network.

```sig
wappsto.configureWifi("ssid", "password")
```

### configure apn

Configurere the APN to which the Wappsto:bit connects when on cellular network.

```sig
wappsto.configureApn("apn")
```

## License

MIT

## Supported targets

* for PXT/microbit

(The metadata above is needed for package search.)
