# HisaabPro — Port Allocation SSOT (5000 Series)

HisaabPro is permanently assigned to the **5000 series**:
- **Backend API**: `http://localhost:5001` (health endpoint: `/api/health`)
- **Frontend Web**: `http://localhost:5002` (Vite dev server)
- **Database**: Postgres database `hisaabpro_dev`

## Global Port Matrix:
- **DudhHisaab**: 4000 series (API `:4001`, Web `:4002`/`:4000`, Admin `:4000`)
- **HisaabPro**: 5000 series (API `:5001`, Web `:5002`)
- **Flint**: 6000 series (API `:6001`, Web `:6100`/`:6002`)
- **RentIncome**: 7000 series (API `:7001`, Web `:7002`)

All scripts (`./start-all.sh`, `./stop-all.sh`), `server/.env` files, Vite configs, API base URLs, and test suites must target port 5001/5002.
