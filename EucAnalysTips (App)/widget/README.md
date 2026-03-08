# Widget usage

```html
<script
  src="https://your-cdn.example/widget.js"
  data-widget-key="demo-public"
  data-api-base-url="https://api.yourdomain.com"
  data-window="WEEK"
></script>
```

Iframe alternative (stable public endpoint):

```html
<iframe
  src="https://api.yourdomain.com/v1/public/widgets/demo-public/embed?window=WEEK"
  style="width:100%;height:420px;border:0;border-radius:12px;"
  loading="lazy"
></iframe>
```

Options:
- `data-widget-key`: required widget key generated in backend
- `data-api-base-url`: backend API base URL
- `data-window`: DAY | WEEK | MONTH | QUARTER | ALL_TIME | CUSTOM
- `data-sport`: optional FOOTBALL | BASKETBALL | TENNIS
