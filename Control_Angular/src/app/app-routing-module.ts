import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard, guestGuard } from './auth/auth.guard';
import { Login } from './auth/login';
import { ControlHome } from './layout/control-home';
import { ControlShell } from './layout/control-shell';
import { CreateProduct } from './products/create-product';
import { EditProduct } from './products/edit-product';
import { ProductsList } from './products/products-list';
import { Quotations } from './quotations/quotations';
import { CreateRfq } from './rfq/create-rfq';
import { CreateVessel } from './vessels/create-vessel';
import { EditVessel } from './vessels/edit-vessel';
import { VesselsList } from './vessels/vessels-list';

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
      { path: 'quotations', component: Quotations },
      { path: 'rfq', component: CreateRfq },
      { path: 'rfq/create', component: CreateRfq },
    ],
  },
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule { }
