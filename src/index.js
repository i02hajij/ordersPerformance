const moment = require('moment'); 
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const fs = require('fs');

// numero de mensajes a crear por bloque
const mensajesPorBloque = 2;

// generar ficheros de esqueletos
const escribir = true;
// enviar o no
const enviar = false;

// Número de artículos en el array por bloque
const numArticulos = [5800, 8000, 11000];
//const numArticulos = [5, 10, 15];

const bloques = numArticulos.length;

// Array que contiene los JSON base de los bloques
const JSONs = new Array();

const generarEsqueletos = (articulos) => {
    // primero vamos a crear el esqueleto del json
    const orderJSON = new Object();  

    // Obtenemos fechas
    const hoy = moment().hour(8).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss[Z]");
    const primerServicio = moment().hour(8).minute(0).second(0).add(1, 'days').format("YYYY-MM-DDTHH:mm:ss[Z]");
    const segundoServicio = moment().hour(8).minute(0).second(0).add(2, 'days').format("YYYY-MM-DDTHH:mm:ss[Z]");

    orderJSON.storeCode = 10110;
    orderJSON.firstServiceDateTime = moment().hour(8).minute(0).second(0).add(1, 'days').format("YYYY-MM-DDTHH:mm:ss[Z]");
    orderJSON.proposalDateTime = moment().hour(8).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss[Z]");
    orderJSON.proposalDeadlineDateTime = moment().hour(8).minute(30).second(0).format("YYYY-MM-DDTHH:mm:ss[Z]");
    orderJSON.orderType = 'RELEX';

    const orderItemTypeInfoArray = new Array();
    const orderItemTypeInfo = new Object();
    orderItemTypeInfo.orderItemType = 'Y';
    orderItemTypeInfo.secondServiceDateTime = segundoServicio;
    orderItemTypeInfo.provisioningBulks = 100;
    orderItemTypeInfo.truckingBulks = 100;
    orderItemTypeInfoArray.push(orderItemTypeInfo);
    orderJSON.orderItemTypeInfo = orderItemTypeInfoArray;

    const orderLines = new Array();

    for(let i = 1; i <= articulos; i++) {
        const orderLine = new Object();
        orderLine.itemCode = i;
        orderLine.quantityFormat = 'UNIT';
        orderLine.proposalQuantity = 10;
        orderLine.undeliveredOrderQuantity = 0;
        orderLine.currentStock = 0;
        orderLine.itemCapacity = 1;
        orderLine.isInPromotion = false;
        orderLine.salesForecast = new Array();
        orderLines.push(orderLine);
    }
    
    orderJSON.orderLines = orderLines;
    orderJSON.isEditable = true;

    return orderJSON;
}

console.log('---- GENERACIÓN ESQUELETOS JSON ----');
// Vamos a construir los JSON de cada bloque
for (let i = 0; i < bloques; i++) {
    const propuesta = generarEsqueletos(numArticulos[i]);
    //console.log('Tamaño JSON ' + (i+1) + ' = ' + new Intl.NumberFormat('es-ES').format((JSON.stringify(propuesta, null, 2).length / 1024).toFixed(0)));
    //console.log('JSON bloque ' + (i+1) + ': ' + propuesta.toString.length);
    if (escribir) {
        const fichero = 'orderBloque' + (i+1) + '.json';
        fs.writeFile(fichero, JSON.stringify(propuesta, null, 2), 'utf8', (err) => {
            if(err) {
                console.log('err');
            } else {
                console.log('Fichero generado');
            }
        })
    }
    JSONs.push(propuesta); 
}

console.log('---- INICIO ENVIOS -----');

// Bucle del número de bloques
for (let i = 0; i < bloques; i++ )
{
    const datos = JSONs[i];

    // número de mensajes por bloque
    for (let j = 1; j <= mensajesPorBloque; j++) {
        // Genero un uuid nuevo para cada envio
        datos.orderProposalCode = uuidv4();
        const data = JSON.stringify(datos);
        if (enviar) {
            axios.post('https://supply-orders-data-es.test.store.dgrp.io/orders-data', data, {
                headers: {
                'Content-Type': 'application/json',
                'ce-event-method': 'add',
                'ce-id': 'performance-test',
                'ce-source': '/performance',
                'ce-type': 'com.dia.store.supply.order.proposal'
                }})
            .then(res => {
                console.log('BLOQUE ' + (i+1) + ' - Mensaje ' + j + ' de ' + mensajesPorBloque + ' statusCode: ' + res.status + ' -- ' + datos.orderProposalCode); 
                //console.log(res)
            })
            .catch(error => {console.log(error.status)}) 
        } else {
            console.log('BLOQUE ' + (i+1) + ' - Mensaje ' + j + ' de ' + mensajesPorBloque + ' statusCode: ' + 200 + ' --- ' + datos.orderProposalCode);  
        } 
    }
}


