/**
 * Worker SignVue — consommateur RabbitMQ (traitement asynchrone / notifications).
 */
const express = require("express");
const amqp = require("amqplib");

const PORT = Number(process.env.PORT) || 3003;
const CONSUL_HOST = process.env.CONSUL_HOST || "localhost";
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const QUEUE_NAME = "signvue.interpretation";
const SERVICE_NAME = "worker-service";
const SERVICE_ID = `${SERVICE_NAME}-${process.env.HOSTNAME || "1"}`;

const app = express();
app.get("/health", (_req, res) => {
    res.json({ status: "up", service: SERVICE_NAME, queue: QUEUE_NAME });
});

async function registerConsul() {
    const address = "worker-service";
    const body = {
        ID: SERVICE_ID,
        Name: SERVICE_NAME,
        Address: address,
        Port: PORT,
        Check: {
            HTTP: `http://${address}:${PORT}/health`,
            Interval: "10s",
            Timeout: "3s",
        },
    };
    try {
        const r = await fetch(`http://${CONSUL_HOST}:8500/v1/agent/service/register`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok) console.warn("Consul register HTTP", r.status);
        else console.log("[worker-service] enregistré dans Consul:", SERVICE_ID);
    } catch (err) {
        console.warn("[worker-service] Consul indisponible:", err.message);
    }
}

function startConsumer() {
    amqp
        .connect(RABBITMQ_URL)
        .then((conn) => {
            conn.on("error", (err) => console.error("[worker-service] RabbitMQ", err.message));
            return conn.createChannel();
        })
        .then((ch) => {
            return ch.assertQueue(QUEUE_NAME, { durable: true }).then(() => ch);
        })
        .then((ch) => {
            ch.prefetch(1);
            console.log("[worker-service] en attente de messages sur", QUEUE_NAME);
            ch.consume(QUEUE_NAME, (msg) => {
                if (!msg) return;
                try {
                    const data = JSON.parse(msg.content.toString());
                    console.log(
                        "[worker-service] traitement job",
                        data.jobId,
                        "| user:",
                        data.userId,
                        "| source:",
                        data.source
                    );
                } catch (e) {
                    console.error("[worker-service] message invalide:", e.message);
                } finally {
                    ch.ack(msg);
                }
            });
        })
        .catch((err) => {
            console.error("[worker-service] échec consommation:", err);
            process.exit(1);
        });
}

app.listen(PORT, async () => {
    console.log(`[worker-service] health sur :${PORT}`);
    await registerConsul();
    startConsumer();
});
