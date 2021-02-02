const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const fs = require("fs");

const directorioSalida = "./output/";

// numero de mensajes a crear por bloque
const mensajesPorBloque = 10;

// generar ficheros de esqueletos
const escribir = false;
// enviar o no
const enviar = true;
// para saber si estamos generando un json para ser ingestado por order-data o es un json de salida de order-data
const entrada = true;

// Número de artículos en el array por bloque
//const numArticulos = [7000, 13000, 20000, 26000];
const numArticulos = [500, 1000, 1500, 2000, 2500];
const bloques = numArticulos.length;

// Array que contiene los JSON base de los bloques
const JSONs = new Array();

// FUNCION: generarEsqueletos
// DETALLE: genera el esqueleto del JSON de orders en función
//          del número de artículos que reciba por parámetros
const generarEsqueletos = (articulos) => {
  // primero vamos a crear el esqueleto del json
  const orderJSON = new Object();
  // Obtenemos fechas
  const hoy = moment()
    .hour(8)
    .minute(0)
    .second(0)
    .format("YYYY-MM-DDTHH:mm:ss[Z]");
  const primerServicio = moment()
    .hour(8)
    .minute(0)
    .second(0)
    .add(1, "days")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");
  const segundoServicio = moment()
    .hour(8)
    .minute(0)
    .second(0)
    .add(2, "days")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");
  const transmittedOrderItemtype = new Array();

  orderJSON.storeCode = 10110;

  if (entrada) {
    orderJSON.proposalDateTime = moment()
      .hour(8)
      .minute(0)
      .second(0)
      .format("YYYY-MM-DDTHH:mm:ss[Z]");
    orderJSON.proposalDeadlineDateTime = moment()
      .hour(8)
      .minute(30)
      .second(0)
      .format("YYYY-MM-DDTHH:mm:ss[Z]");
  } else {
    orderJSON.orderDateTime = moment()
      .hour(8)
      .minute(0)
      .second(0)
      .format("YYYY-MM-DDTHH:mm:ss[Z]");
    transmittedOrderItemtype.push("Y");
    orderJSON.transmittedOrderItemtype = transmittedOrderItemtype;
  }

  orderJSON.firstServiceDateTime = moment()
    .hour(8)
    .minute(0)
    .second(0)
    .add(1, "days")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");
  orderJSON.orderType = "RELEX";

  const orderItemTypeInfoArray = new Array();
  const orderItemTypeInfo = new Object();
  orderItemTypeInfo.orderItemType = "Y";
  orderItemTypeInfo.secondServiceDateTime = segundoServicio;
  if (entrada) {
    orderItemTypeInfo.provisioningBulks = 100;
    orderItemTypeInfo.truckingBulks = 100;
    orderJSON.isEditable = true;
  }
  orderItemTypeInfoArray.push(orderItemTypeInfo);
  orderJSON.orderItemTypeInfo = orderItemTypeInfoArray;

  const orderLines = new Array();

  for (let i = 1; i <= articulos; i++) {
    const orderLine = new Object();
    orderLine.itemCode = i;
    orderLine.quantityFormat = "UNIT";
    orderLine.proposalQuantity = 10;
    if (entrada) {
      orderLine.undeliveredOrderQuantity = 0;
      orderLine.currentStock = 0;
      orderLine.itemCapacity = 1;
      orderLine.isInPromotion = false;
      orderLine.salesForecast = new Array();
    } else {
      orderLine.lastUpdatedDateTime = null;
      orderLine.modifiedQuantity = 9;
    }
    orderLines.push(orderLine);
  }

  orderJSON.orderLines = orderLines;

  return orderJSON;
};

// FUNCION: enviarDatos
// DETALLE: Se encarga de hacer el post contra supply-orders-data
const enviarDatos = async (data, i, j, propuesta) => {
  const start = new Date().getTime();
  let total = 0;
  await axios
    .post(
      "https://supply-orders-data-es.test.store.dgrp.io/orders-data",
      data,
      {
        headers: {
          "Content-Type": "application/json",
          "ce-event-method": "add",
          "ce-id": "performance-test",
          "ce-source": "/performance",
          "ce-type": "com.dia.store.supply.order.proposal",
        },
        timeout: 50000,
      }
    )
    .then((res) => {
      const end = new Date().getTime();
      const totalServicio = new Date(end - start).getTime();
      console.log(
        "Mensaje " +
          j +
          " de " +
          mensajesPorBloque +
          " - statusCode: " +
          res.status +
          " - " +
          propuesta +
          " - Tiempo: " +
          totalServicio +
          " ms"
      );
      total = totalServicio;
    })
    .catch((error) => {
      console.log(error.status);
    });
  return total;
};

// FUNCION: pruebaRendimiento
// DETALLE: Funcion principal que se encarga de:
//          - Construir los JSONs (llamar a generarEsqueletos)
//          - Escribir los JSONs a fichero (en caso de ser necesario)
//          - Llamar a enviarDatos
const pruebaRendimiento = async () => {
  let orderCode = 0;
  // Vamos a construir los JSON de cada bloque
  for (let i = 0; i < bloques; i++) {
      const propuesta = generarEsqueletos(numArticulos[i]);
      if (!entrada) {
        orderCode++;
        propuesta.orderCode = orderCode;
      }
      if (escribir) {
        const fichero =
          directorioSalida + "orderBloque" + (i + 1) + ".json";
        fs.writeFile(
          fichero,
          JSON.stringify(propuesta, null, 2),
          "utf8",
          (err) => {
            if (err) {
              console.log("err");
            } else {
              console.log("Fichero generado");
            }
          }
        );
      }
      JSONs.push(propuesta);
  }

  //console.log(JSONs);

  // Bucle del número de bloques
  for (let i = 0; i < bloques; i++) {
    const datos = JSONs[i];
    const bytes = new Intl.NumberFormat('es-ES').format((JSON.stringify(JSONs[i], null, 2).length / 1024).toFixed(0))
    console.log("BLOQUE " + (i + 1) + ": Número artículos " + numArticulos[i] + " - Tamaño aprox " + bytes + " KB") ;
    console.log("---------------------------------------------------------");
    let max = 0;
    let min = 999999999;
    let tiempoTotal = 0;
    // número de mensajes por bloque
    for (let j = 1; j <= mensajesPorBloque; j++) {
      // Genero un uuid nuevo para cada envio
      datos.orderProposalCode = uuidv4();
      const data = JSON.stringify(datos);
      if (enviar) {
        const total = await enviarDatos(data, i, j, datos.orderProposalCode);
        tiempoTotal += total;
        if (total > max) {
          max = total;
        }
        if (total < min) {
          min = total;
        }
      } else {
        console.log(
          "BLOQUE " +
            (i + 1) +
            " - Artículos: " +
            numArticulos[i] +
            " - Mensaje " +
            j +
            " de " +
            mensajesPorBloque +
            " statusCode: " +
            200 +
            " --- " +
            datos.orderProposalCode
        );
      }
    }
    console.log(
      "Tiempo Máximo = " +
        max +
        " -- Tiempo mínimo = " +
        min +
        "  -- Media = " +
        (tiempoTotal / mensajesPorBloque).toFixed(0) +
        " -- Media por artículo = " +
        (tiempoTotal / mensajesPorBloque / numArticulos[i]).toFixed(2)
    );
    console.log("\n");
  }
};

pruebaRendimiento();
