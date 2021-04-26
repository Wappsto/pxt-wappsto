# Wappsto:bit protocol

This is a description on the protocol for exchaning data between Wappsto:bit and micro:bit. This documentation covers protocol used in PXT version 1.0.x.
This documentation is interesting for you if you are looking to **a)** replace the micro:bit with something else and still talk to the Wappsto:bit, **b)** talk to the micro:bit with this code, but write you own interpreter, or **c)** out of curiosity. If you intend to use the Wappsto:bit as it is, you do not need to know this information.

Communication is over I2C where the micro:bit is master, and the Wappsto:bit slave. The I2C address of the Wappsto:bit is `0x11`. There is a maximum length of each message on 256 bytes.
As the micro:bit is master it will ask for data every 100ms, to ensure it will not miss any event.
Every 5 seconds it will ask for extended information - see [Request info](#request-info).

The communication between Wappsto:bit and micro:bit is done using JSON, encoded in UTF-8.

## Send and receive data

The Wappsto:bit has 20 values that can be used, and as Wappsto requires the data model to define if the value is number or a string, they have been seperated by value id.
* Value id: 1-15 are numbers
* Value id: 16-20 are strings

Wappsto has the option to group values under multiple virtual devices, but this implementation only uses 1 device, so that is why all devices must be `"device":1`


### Send and receive numbers
To send an data value from the micro:bit, where id is a number between 1-15, and `"number"` is the content.
If the Wappsto:bit want to send data to the micro:bit the format is the same.
```
{"device":1,"value":id,"data":"number"}
```
An example:
```
{"device":1,"value":1,"data":"27.5"}
```

### Send and receive strings
To send an data value from the micro:bit, where id is a number between 16-20, and `"string"` is the content.
If the Wappsto:bit want to send data to the micro:bit the format is the same.
```
{"device":1,"value":id,"data":string"}
```
An example:
```
{"device":1,"value":16,"data":"Hi"}
```


## Configure data values
To personlize your Wappsto:bit it is possible to name the device and provide addidtional information to the describe what the data mean.

### Name your Wappsto:bit
To name your Wappsto:bit, where `string` is the name to use.

```
{"device":1,"name":"string"}
```
An example:
```
{"device":1,"name":"My Wappsto:bit"}
```

### Name your values
The values can be setup so it is easier to understand what they contain. Both numbers and strings have `"name"` and `"type"`:
* `"name"` is the name you want to give your value
* `"type"` is a description of the data, so the Dashboard can help to show it better, examples on these are: "temperature", "sound level". And it is visible in the Dashboard when using types "latitude" and "longitude", as these values will be shown on a map as well.

To help the Dashbord further, numbers also have these settings:
* `"min"`: Minimum value a number can have - for example -40, for the temperature sensor measuring in degree celcius.
* `"max"`: Maximum value a number can have - for example 105, for the temperature sensor measuring in degree celcius.
* `"step"`: How big steps can the value jump - for example 1 if it is button press, or 0.25 for temperature.
* `"unit"`: The unit of physical measurements - for example °C for temperature.

So the full setup could be:
```
{"device":1,"value":1,"name":"Temperature","type": "temperature","min":-40,"max":105,"step":0.25,"unit":"°C"}
```

Strings are a bit more simple, as they do not have any extra settings. So it could be:
```
{"device":1,"value":16,"name":"MyString","type": "string"}
```

## Advanced options

These messages are either optional to use or they are normally used without you realising they are exchanged between the Wappsto:bit and the micro:bit.

### Request info

Every 5 seconds the micro:bit will send this message:
```
{"command":"info"}
```

And the Wappsto:bit can send data containing these value pairs:

* `"lon"`: If the Wappsto:bit HW has GPS, this is the longitude - if not the value will be 0.
* `"lat"`: If the Wappsto:bit HW has GPS, this is the latitude - if not the value will be 0
* `"signal"`: Signal strength in %, this will either be for WiFi or NB-IoT depending on connection.
* `"status"`: A string to describe what status the Wappsto:bit is in.
* `"network"`: Description on the network connection, for WiFi you can see which SSID you are connected to.
* `"uptime"`: Is the number of seconds the Wappsto:bit has been running since last boot.
* `"utc_time"`: Current UTC time.
* `"ready"`: A flag ("0" or "1") informing if the Wappsto:bit is connected to Wappsto.
* `"queue_full"`: A flash ("0" or "1") telling the micro:bit if it possible to send data to the Wappsto:bit.
* `"version"`: The version of the protocol the Wappsto:bit supports, currently 0.0.1. Note that this version is not related to the PXT version nor the firmware version of the Wappsto:bit.

An example on this:
```
{"lon":"9.883900","lat":"57.019741","signal":"90","status":"Connected to Wappsto","network":"WIFI: MyWifi","uptime":"5640","utc_time":"1611151491","ready":"1","queue_full":"0","version":"0.0.1"}
```

### Set SSID and Password

Instead of using the Wappsto App (https://play.google.com/store/apps/details?id=com.wappsto_native or https://apps.apple.com/dk/app/id1482236314) to get the Wappsto:bit connected to WiFi, you can set the SSID and password in the program on your micro:bit.
*Note:* Wappsto:bit supports UTF-8 charset whereas makecode blocks only support a limited ASCII charset. If WiFi settings require more excotic characters use the Wappsto App to configure the Wappsto:bit using Bluetooth.

```
{"command":"config_wifi", "ssid":"SSID", "pass":"password"}
```
An example:
```
{"command":"config_wifi", "ssid":"MyWifi", "pass":"12345678"}
```

### Set APN name (NB-IoT only)

If you have a Wappsto:bit that supports NB-IoT, but not a SIM card that is supported by default (Telenor), you can set a different APN mayching your SIM card via. the micro:bit.

```
{"command":"config_apn", "apn":"NAME"}
```
An example:
```
{"command":"config_apn", "apn":"telenor.iot"}
```

### Request clear data model on Wappsto

The Wappsto:bit will automatically clean the data model on Wappsto during startup, but if you desire to change data model at runtime it is possible. Call this command, and the Wappsto:bit will clear the names and description on the current values:

```
{"command":"clean"}
```
### Asynchronous data

Most commands are issued by the micro:bit, except few. Besides receiving data as described in [Send and receive data](#send_and_receive_data), and the following commands:

#### First location found

If the Wappsto:bit has a GPS chip, the first time, after boot, it gets a location, it will send this, an example:
```
{"lon":"9.883900","lat":"57.019741"}
```

#### Connection status changes

If the connection to Wappsto should change, or you want to follow what happends during boot, `"status"` and `"ready"` will be send from the Wappto:bit For example:
```
{"status":"Connecting to Wappsto","ready":"0"}
```

#### Queue full

If the micro:bit is sending values faster than the Wappsto:bit can send them to Wappsto, the Wappsto:bit will send a message `"queue_full"` indicating if micro:bit should stop sending data, or it can resume. Example on the queu being full:
```
{"queue_full":"1"}
```
