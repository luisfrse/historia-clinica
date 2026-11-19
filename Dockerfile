FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY . .
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
