# walkner-iovis

A simple app for visualizing the current I/O state of a IEEE1451 through CoAP device.

## Requirements

### node.js

Node.js is a server side software system designed for writing scalable
Internet applications in JavaScript.

  * __Version__: 0.12.x
  * __Website__: http://nodejs.org/
  * __Download__: http://nodejs.org/download/
  * __Installation guide__: https://github.com/joyent/node/wiki/Installation

## Installation

Clone the repository:

```
git clone git://github.com/morkai/walkner-iovis.git
```

or [download](https://github.com/morkai/walkner-iovis/zipball/master)
and extract it.

Go to the project directory and install the dependencies:

```
cd walkner-iovis/
npm install
```

## Start

Start the application server in the `development` environment:

  * under Linux:

    ```
    NODE_ENV=development node walkner-iovis/backend/main.js ../config/server.js
    ```

  * under Windows:

    ```
    SET NODE_ENV=development
    node walkner-iovis/backend/main.js ../config/server.js
    ```

Application should be available on a port defined in the `config/server.js` file
(`1337` by default). Point your Internet browser to http://127.0.0.1:1337/.

## License

This project is released under the [MIT License](https://raw.github.com/morkai/walkner-iovis/master/license.md).
