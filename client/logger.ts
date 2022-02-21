export default function Log(message: any, isCritical = false): void {

    var logMessage = process.env.LOGMODE === "TEXT" ? message : JSON.stringify({
        Message: message,
        Level: isCritical ? 'Error' : 'Info',
        App: 'SeleniumScaler',
        Date: new Date().toUTCString()
    });

    if (isCritical) {
        console.error(logMessage);
    } else {
        console.log(logMessage);
    }
}