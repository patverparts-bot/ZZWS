-- Historical catalogue arrival metadata repair; no prices, stocks or publication dates change.
-- Exact state/product hashes are checked under the publication state lock. JSON below contains metadata only.
do $arrival_repair_body$
declare manifest jsonb := $arrival_repair_manifest${
  "format": "zzws-product-arrivals-repair-v1",
  "before": {
    "versions": [
      {
        "id": "5d58a90d-a1a5-4664-8449-0ce2850e76a2",
        "created": "2026-10-27T09:34:48.198088Z",
        "productsMd5": "cbc6ce9817c52415b43d41ab688d7d49",
        "productCount": 7237
      },
      {
        "id": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71",
        "created": "2026-10-28T08:24:18.119564Z",
        "productsMd5": "420d35b408b718f9f3411cdff4f10bfd",
        "productCount": 7209
      },
      {
        "id": "8b1aa1a0-b889-4787-8af9-17c0b974a645",
        "created": "2026-10-29T13:49:52.057803Z",
        "productsMd5": "823fb72fb33a27863732947a91cbcce8",
        "productCount": 7203
      },
      {
        "id": "96f53047-7eb4-498c-9e11-7a21d4103621",
        "created": "2026-10-30T07:18:41.039132Z",
        "productsMd5": "c78529b110a6f4456f61c5e609571ed6",
        "productCount": 7204
      },
      {
        "id": "9656bdac-abe1-45f0-9396-b447086a6fa9",
        "created": "2026-10-30T09:50:56.019727Z",
        "productsMd5": "496bb8bc74f4229671f85e57a7ea268b",
        "productCount": 7204
      }
    ],
    "rulesRevision": "d9eb834c-3731-41f8-909d-7f643cfe0cdb",
    "currentVersion": "9656bdac-abe1-45f0-9396-b447086a6fa9",
    "catalogRevision": "cee41bbe-c512-4673-a4c4-e4ee1bfe9eca"
  },
  "after": {
    "versions": [
      {
        "id": "5d58a90d-a1a5-4664-8449-0ce2850e76a2",
        "created": "2026-10-27T09:34:48.198088Z",
        "productsMd5": "cbc6ce9817c52415b43d41ab688d7d49",
        "productCount": 7237
      },
      {
        "id": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71",
        "created": "2026-10-28T08:24:18.119564Z",
        "productsMd5": "5e81971832eafbb553c8eefc5169488d",
        "productCount": 7209
      },
      {
        "id": "8b1aa1a0-b889-4787-8af9-17c0b974a645",
        "created": "2026-10-29T13:49:52.057803Z",
        "productsMd5": "31093c5d3d1a3d610eee127d081e00d8",
        "productCount": 7203
      },
      {
        "id": "96f53047-7eb4-498c-9e11-7a21d4103621",
        "created": "2026-10-30T07:18:41.039132Z",
        "productsMd5": "b0d0673c6edd6101f78b88a2c4242ae0",
        "productCount": 7204
      },
      {
        "id": "9656bdac-abe1-45f0-9396-b447086a6fa9",
        "created": "2026-10-30T09:50:56.019727Z",
        "productsMd5": "8d96d40a9321eca32da551f79b037f6f",
        "productCount": 7204
      }
    ],
    "rulesRevision": "d9eb834c-3731-41f8-909d-7f643cfe0cdb",
    "currentVersion": "9656bdac-abe1-45f0-9396-b447086a6fa9",
    "catalogRevision": "dbd39155-9598-4bab-97ea-955f7fbf4ea6"
  },
  "patches": [
    {
      "articul": "0300888",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "176451",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "332403",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "426766662",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "510342",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "528283",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "528284",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "528286",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "571303",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "6009500",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "608205",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "68165122",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "689995",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "720188",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "730723",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "730724",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "757105",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "757132",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "757141",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "757142",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "757143",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "757144",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "757145",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "757207",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "757225",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "757260",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "757262",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "757264",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "7584102",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "763218",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "763219",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "815154",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "890084",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "9012185",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "970373",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "bb0acb66-d5a6-4a54-ad62-3eecfa4adf71"
    },
    {
      "articul": "0300888",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "176451",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "299600",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "332403",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "3493704",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "3493708",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "3493715",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "3493716",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "426766662",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "510342",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "528117",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "528283",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "528284",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "528286",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "571303",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "6009500",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "6009852",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "601011",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "608205",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "608206",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "68165122",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "689995",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "720188",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "730723",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "730724",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "757105",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "757132",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "757141",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "757142",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "757143",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "757144",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "757145",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "757207",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "757225",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "757260",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "757262",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "757264",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "7584102",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "763218",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "763219",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "815154",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "890084",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "9012185",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "970373",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "O745802",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "8b1aa1a0-b889-4787-8af9-17c0b974a645"
    },
    {
      "articul": "0300886",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "0300888",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "0540811",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "0540828",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "176451",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "299600",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "332403",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "346907437",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "347700773",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "347700785",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "3493704",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "3493708",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "3493715",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "3493716",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "426766662",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "510342",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "5201751",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "5202639",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "5202659",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "520296",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "5203338",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "528117",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "528283",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "528284",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "528286",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "571303",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "6009500",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "6009852",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "601011",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "608205",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "608206",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "670150",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "68165122",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "689995",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "7201842",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "720188",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "720256",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "720257",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "730216",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "730723",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "730724",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "7501152",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "7501153",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "7501154",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "7501155",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "757105",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "757132",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "757141",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "757142",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "757143",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "757144",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "757145",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "757207",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "757225",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "757260",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "757262",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "757264",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "758317",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "7584102",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "763218",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "763219",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "815154",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "890084",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "9012185",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "970373",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "O745802",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "96f53047-7eb4-498c-9e11-7a21d4103621"
    },
    {
      "articul": "0300886",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "0300888",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "0540811",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "0540828",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "176451",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "299600",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "332403",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "346907437",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "347700771",
      "newValue": "2026-10-30T09:50:56.019727Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "347700772",
      "newValue": "2026-10-30T09:50:56.019727Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "347700773",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "347700777",
      "newValue": "2026-10-30T09:50:56.019727Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "347700778",
      "newValue": "2026-10-30T09:50:56.019727Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "347700781",
      "newValue": "2026-10-30T09:50:56.019727Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "347700782",
      "newValue": "2026-10-30T09:50:56.019727Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "347700791",
      "newValue": "2026-10-30T09:50:56.019727Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "3493704",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "3493708",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "3493715",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "3493716",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "4267554910",
      "newValue": "2026-10-30T09:50:56.019727Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "426766662",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "510342",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "5201751",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "5202639",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "5202659",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "520296",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "5203338",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "528117",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "528283",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "528284",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "528286",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "571303",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "6009500",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "6009852",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "601011",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "608205",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "608206",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "670150",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "68165122",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "689995",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "7201842",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "720188",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "720256",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "720257",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "730216",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "730723",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "730724",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "7501152",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "7501153",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "7501154",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "7501155",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "757105",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "757132",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "757141",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "757142",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "757143",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "757144",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "757145",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "757207",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "757225",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "757260",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "757262",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "757264",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "758317",
      "newValue": "2026-10-30T07:18:41.039132Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "7584102",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "763218",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "763219",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "815154",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "890084",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "9012185",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "970373",
      "newValue": "2026-10-28T08:24:18.119564Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    },
    {
      "articul": "O745802",
      "newValue": "2026-10-29T13:49:52.057803Z",
      "oldValue": null,
      "hadOldKey": false,
      "versionId": "9656bdac-abe1-45f0-9396-b447086a6fa9"
    }
  ],
  "summary": {
    "currentCandidates": 73,
    "changedMetadataRows": 219,
    "changedVersions": 4,
    "existingValidDates": 0
  }
}$arrival_repair_manifest$::jsonb; actual jsonb; changed integer;
begin
 perform 1 from public.zzws_state where id=true for update;
 perform 1 from public.zzws_versions order by created,id for update;
 select snapshot into actual from (select jsonb_build_object(
 'currentVersion',s.version,'rulesRevision',s.rules_revision,'catalogRevision',s.catalog_controls_revision,
 'versions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'created',to_char(v.created at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'productsMd5',md5(v.products::text),'productCount',jsonb_array_length(v.products)) order by v.created,v.id) from public.zzws_versions v),'[]'::jsonb)) as snapshot
 from public.zzws_state s where s.id=true) state;
 if actual is null then raise exception 'Catalogue state is missing' using errcode='PT409'; end if;
 if actual=manifest->'after' then return; end if;
 if actual->'currentVersion'='null'::jsonb and actual->'versions'='[]'::jsonb then return; end if; -- Fresh installation has no historical metadata to recover.
 if actual is distinct from manifest->'before' then raise exception 'Arrival repair CAS failed: catalogue/state changed; regenerate read-only plan' using errcode='PT409'; end if;
 with patches as (
  select p.value as p from jsonb_array_elements(manifest->'patches') p
 ), rebuilt as (
  select v.id,jsonb_agg(case when patch.p is null then item.value
   else jsonb_set(item.value,'{introducedAt}',patch.p->'newValue',true) end order by item.ordinality) as products
  from public.zzws_versions v cross join lateral jsonb_array_elements(v.products) with ordinality item
  left join patches patch on (patch.p->>'versionId')::uuid=v.id and patch.p->>'articul'=item.value->>'articul'
  group by v.id having bool_or(patch.p is not null)
 ) update public.zzws_versions v set products=r.products from rebuilt r where r.id=v.id;
 get diagnostics changed=row_count;
 if changed<>(manifest->'summary'->>'changedVersions')::integer then raise exception 'Arrival repair version count mismatch' using errcode='PT409'; end if;
 -- This is the existing catalogue/storefront presentation cache revision, never the pricing rules revision.
 update public.zzws_state set catalog_controls_revision=(manifest->'after'->>'catalogRevision')::uuid where id=true;
 select snapshot into actual from (select jsonb_build_object(
 'currentVersion',s.version,'rulesRevision',s.rules_revision,'catalogRevision',s.catalog_controls_revision,
 'versions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'created',to_char(v.created at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'productsMd5',md5(v.products::text),'productCount',jsonb_array_length(v.products)) order by v.created,v.id) from public.zzws_versions v),'[]'::jsonb)) as snapshot
 from public.zzws_state s where s.id=true) state;
 if actual is distinct from manifest->'after' then raise exception 'Arrival repair postcondition failed; all changes rolled back' using errcode='PT409'; end if;
end;
$arrival_repair_body$;
