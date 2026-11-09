import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Quotations } from './quotations/quotations';

const routes: Routes = [
  { path: '', component: Quotations },
  { path: 'quotations', component: Quotations },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule { }
