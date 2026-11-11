![fuxa logo](/client/src/favicon.ico) 
# FUXA
FUXA is a web-based Process Visualization (SCADA/HMI/Dashboard) software. With FUXA you can create modern process visualizations with individual designs for your machines and real-time data display.

This snapshot contains FUXA 1.3.6-3007, including the SVG controls and user images in `_images`.

![fuxa editor](/screenshot/fuxa-editor.png) 

![fuxa ani](/screenshot/fuxa-thinglinks.gif)

![fuxa action](/screenshot/feature-action-move.gif)

## Features
- Devices connectivity with Modbus RTU/TCP, Siemens S7 Protocol, OPC-UA, BACnet IP, MQTT, WebAPI, Ethernet/IP (Allen Bradley), ADSclient, Gpio (Raspberry), WebCam, MELSEC, ODBC, Redis
- SCADA/HMI Web-Editor - Engineering and Design completely web-based
- Cross-Platform Full-Stack - Backend with NodeJs and Frontend with Web technologies (HTML5, CSS, Javascript, Angular, SVG)

## Live Demo
Here is a [live demo](https://frangoteam.github.io) example of FUXA editor.

## Installing and Running
FUXA is developed with NodeJS (backend) and Angular (frontend). To run this snapshot:
```
npm install
npm start -- --port 1882
```

Open a browser (Chrome recommended) and navigate to http://localhost:1882. If you start with a custom `--userDir`, copy this snapshot's `_images` directory into that user-data directory to use the included image libraries.

## Usage
- Look the guide in [wiki](https://frangoteam.github.io/FUXA/) pages
- Look video from [frangoteam](https://www.youtube.com/@umbertonocelli5301)


## Let us know!
We’d be really happy if you send us your own shapes in order to collect a library to share it with others. Just send an email to 4frango@gmail.com and do let us know if you have any questions or suggestions regarding our work.

## <a href="https://discord.gg/WZhxz9uHh4" target="_blank" > <img src="https://skillicons.dev/icons?i=discord" alt=""></a>

## License
MIT.
