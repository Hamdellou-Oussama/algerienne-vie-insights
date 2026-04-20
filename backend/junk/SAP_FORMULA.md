Soit **D** date cloture SAP.

* **Si** **$D < \text{date Declaration} \Rightarrow 0$**
* **Si** **$\text{dat dec} < D < \text{dat Reglement} \Rightarrow \text{Montant Sinistre}$**
* **Si** **$D > \text{date Reglement, voir statut:}$**

$$
\begin{cases} \text{Rejet} \rightarrow 0 \\ \text{Reglé} \rightarrow \quad (\max(0,  \text{Montant} - \text{Reglé})) \\ \text{SAP} \rightarrow \text{montant} \text{ (even check that montant regle is 0 as a bonus)} \end{cases}
$$


I am planning on the moving to the next phase of the hackathon: linking the frontend to the backend.
  the algorithms now work perfectly well (they do, right?), so now it is ready to be used as backend. I
  am thinking of FastAPI, but choose any framework you deem worthy. create a PLAN-BACKEND.md to carry out
  this change. here are some directions:

- we need XLSX upload and download endpoints
- we will just use local storage/miniio, your call
- basically the fronted has 6 pages + main dashboard page: PPNA, SAP, PE, PB, IBNR, and Bilan, so each
  page should have its proper routes.
- the frontend is yet to be implemented, so we are free to make the frontend follow our endpoint
  structure
- the app is
