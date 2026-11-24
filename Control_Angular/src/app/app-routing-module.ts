import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard, guestGuard } from './auth/auth.guard';
import { Login } from './auth/login';
import { ControlHome } from './layout/control-home';
import { ControlShell } from './layout/control-shell';
import { CategoriesList } from './categories/categories-list';
import { CreateCategory } from './categories/create-category';
import { EditCategory } from './categories/edit-category';
import { CreateProduct } from './products/create-product';
import { EditProduct } from './products/edit-product';
import { ProductsList } from './products/products-list';
import { Quotations } from './quotations/quotations';
import { ConfirmRfq } from './rfq/confirm-rfq';
import { CreateRfq } from './rfq/create-rfq';
import { RfqEmail } from './rfq/rfq-email';
import { RfqList } from './rfq/rfq-list';
import { RfqOffers } from './rfq/rfq-offers';
import { SupplierBoard } from './suppliers/supplier-board';
import { CreateVessel } from './vessels/create-vessel';
import { EditVessel } from './vessels/edit-vessel';
import { VesselsList } from './vessels/vessels-list';
import { ShipShell } from './ship/ship-shell';
import { ShDashboard } from './ship/pages/sh-dashboard';
import { ShReports } from './ship/pages/sh-reports';
import { ShFleet } from './ship/pages/sh-fleet';
import { ShParticulars } from './ship/pages/sh-particulars';
import { ShRequests } from './ship/pages/sh-requests';
import { ShRequestNew } from './ship/pages/sh-request-new';
import { ShRequestDetail } from './ship/pages/sh-request-detail';
import { ShStores } from './ship/pages/sh-stores';
import { ShTanks } from './ship/pages/sh-tanks';
import { ShDaily } from './ship/pages/sh-daily';
import { ShLog } from './ship/pages/sh-log';
import { ShVoyages } from './ship/pages/sh-voyages';
import { ShPlanner } from './ship/pages/sh-planner';
import { ShPorts } from './ship/pages/sh-ports';
import { ShClients } from './ship/pages/sh-clients';
import { ShSuppliers } from './ship/pages/sh-suppliers';
import { ShCatalog } from './ship/pages/sh-catalog';
import { ShCrew } from './ship/pages/sh-crew';
import { ShCertificates } from './ship/pages/sh-certificates';
import { ShUsers } from './ship/pages/sh-users';
import { ShSettings } from './ship/pages/sh-settings';

const routes: Routes = [
  {
    path: 'login',
    component: Login,
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: ControlShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', component: ControlHome },
      { path: 'products', component: ProductsList },
      { path: 'products/create', component: CreateProduct },
      { path: 'products/edit/:id', component: EditProduct },
      { path: 'products/edit', redirectTo: 'products', pathMatch: 'full' },
      { path: 'products/delete', redirectTo: 'products', pathMatch: 'full' },
      { path: 'vessels', component: VesselsList },
      { path: 'vessels/create', component: CreateVessel },
      { path: 'vessels/edit/:id', component: EditVessel },
      { path: 'vessels/edit', redirectTo: 'vessels', pathMatch: 'full' },
      { path: 'categories', component: CategoriesList },
      { path: 'categories/create', component: CreateCategory },
      { path: 'categories/edit/:id', component: EditCategory },
      { path: 'categories/edit', redirectTo: 'categories', pathMatch: 'full' },
      { path: 'quotations', component: Quotations },
      { path: 'suppliers', component: SupplierBoard },
      { path: 'rfq', component: RfqList },
      { path: 'rfq/create', component: CreateRfq },
      { path: 'rfq/:id/offers', component: RfqOffers },
      { path: 'rfq/:id/confirm', component: ConfirmRfq },
      { path: 'rfq/:id/email', component: RfqEmail },
      { path: 'rfq/:id', component: CreateRfq },
      {
        path: 'ship',
        component: ShipShell,
        children: [
          { path: '', pathMatch: 'full', component: ShDashboard },
          { path: 'reports', component: ShReports },
          { path: 'fleet', component: ShFleet },
          { path: 'particulars/:id', component: ShParticulars },
          { path: 'particulars', component: ShParticulars },
          { path: 'requests', component: ShRequests },
          { path: 'requests/new', component: ShRequestNew },
          { path: 'requests/:id', component: ShRequestDetail },
          { path: 'stores', component: ShStores },
          { path: 'tanks', component: ShTanks },
          { path: 'daily', component: ShDaily },
          { path: 'log', component: ShLog },
          { path: 'voyages', component: ShVoyages },
          { path: 'planner', component: ShPlanner },
          { path: 'ports', component: ShPorts },
          { path: 'clients', component: ShClients },
          { path: 'cargo', redirectTo: 'particulars', pathMatch: 'full' },
          { path: 'suppliers', component: ShSuppliers },
          { path: 'catalog', component: ShCatalog },
          { path: 'crew', component: ShCrew },
          { path: 'certificates', component: ShCertificates },
          { path: 'users', component: ShUsers },
          { path: 'settings', component: ShSettings },
          { path: 'inventory', redirectTo: 'stores', pathMatch: 'full' },
          { path: 'report', redirectTo: 'daily', pathMatch: 'full' },
          { path: 'bunkering', redirectTo: 'tanks', pathMatch: 'full' },
          { path: 'voyage', redirectTo: 'voyages', pathMatch: 'full' },
          { path: 'route-map', redirectTo: 'voyages', pathMatch: 'full' },
          { path: 'maintenance', redirectTo: 'stores', pathMatch: 'full' },
          { path: 'operations', redirectTo: 'stores', pathMatch: 'full' },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule { }
