{
    wappsto.sendNumberToWappsto(1, 1, WappstoTransmit.OnChange);
    wappsto.sendStringToWappsto("string", 16, WappstoTransmit.ASAP);
    wappsto.configureName("MyBit");
    wappsto.configureValue(2, "configure value", WappstoValueTemplate.Light);
    wappsto.configureNumberValue(3, "Configure Number value", "test", -1, 2, 1, "none");
    wappsto.configureStringValue(17, "configure string value", "test");
    wappsto.onNumberEvent(3, (num) => { });
    wappsto.onStringEvent(16, (str) => { });
    wappsto.sendCleanToWappsto();
    wappsto.longitude();
    wappsto.latitude();
    wappsto.signalQuality();
    wappsto.carrier();
    wappsto.timeUtc();
    wappsto.uptime();
    wappsto.connected();
    wappsto.configureWifi("ssid", "passsword");
    wappsto.configureApn("new apn");
}
