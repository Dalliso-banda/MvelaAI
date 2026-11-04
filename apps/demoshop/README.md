# Chalo Threads: demo shop for Mvela Lookups

A tiny fake online shop with made-up orders (`TZ-1001` to `TZ-1006`). It shows how a company connects its own system to Mvela:
the shop has an order API, Mvela calls it as a **Lookup**, and the chat widget on the shop page answers "where is my order?".
Nothing here is real data. No dependencies; plain Node.

## Run it locally

1. `cp apps/demoshop/.env.example apps/demoshop/.env`
2. In Mvela, sign up, open **Publish widget**, switch it on, and copy the key into `WIDGET_KEY` in `apps/demoshop/.env`.
3. In `apps/api/.env` add `ALLOW_PRIVATE_CONNECTORS=true` (development only: it lets Mvela call `http://localhost`) and restart the API.
4. `npm run dev:shop`, then open http://localhost:4200 (the chat bubble appears bottom right).

## Add the two Lookups in Mvela (dashboard, Lookups, New lookup)

| Field | Order status | Stock check |
|---|---|---|
| Name | `order_status` | `stock_check` |
| What it does | Look up an order's status by its order number, like TZ-1001. | Check whether an item (jacket, coat, sneakers, shirt) is in stock. |
| Your API address | `http://localhost:4200/api/orders/{order_id}` | `http://localhost:4200/api/stock/{item}` |
| What the customer provides | `order_id` | `item` |
| Auth header name | `x-shop-key` | `x-shop-key` |
| Secret value | `demo-shop-key` (your `SHOP_API_KEY`) | same |
| Fields the AI may share | `order_id, status, estimated_delivery, carrier, tracking_number, delay_reason, refund_status, pickup_location, items` | `item, in_stock, sizes, price_zmw, restock` |

Press the play button on a lookup to see exactly what the AI would see. The shop's order API also returns `customer_email` and
`internal_note`; they are not in the list above, so Mvela never passes them to the AI.

Try: "Where is TZ-1001?", "Why is TZ-1004 late?", "What happened to TZ-1005?", "Is the winter coat in stock?"

## On a server (artasylum.xyz)

Run it with pm2 and let nginx serve it under `/demo-shop/` (no new DNS needed). Set `SHOP_API_KEY` to a long random value,
`MVELA_URL=https://artasylum.xyz` and `WIDGET_KEY` in `apps/demoshop/.env`.

```
pm2 start npm --name chalo-shop -- run start -w apps/demoshop
```

nginx, inside the existing `server { ... }` block for artasylum.xyz:

```
location /demo-shop/ {
    proxy_pass http://127.0.0.1:4200/;
    proxy_set_header Host $host;
}
```

Then the lookup addresses become `https://artasylum.xyz/demo-shop/api/orders/{order_id}` and `https://artasylum.xyz/demo-shop/api/stock/{item}`
(and `ALLOW_PRIVATE_CONNECTORS` must be off on the server).
