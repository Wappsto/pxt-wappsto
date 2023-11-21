{
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
    if (isNaN(lat) || isNaN(lon)) {
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

    basic.showNumber(wappsto.time());
    basic.pause(1000);
    basic.showNumber(wappsto.uptime());
}
