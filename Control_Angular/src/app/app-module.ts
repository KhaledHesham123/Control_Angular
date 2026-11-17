import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { authInterceptor } from './auth/auth.interceptor';
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
import { CategoryLookup } from './shared/category-lookup';
import { CreateVessel } from './vessels/create-vessel';
import { EditVessel } from './vessels/edit-vessel';
import { VesselsList } from './vessels/vessels-list';

@NgModule({
  declarations: [
    App,
    Login,
    ControlShell,
    ControlHome,
    CategoryLookup,
    ProductsList,
    CreateProduct,
    EditProduct,
    VesselsList,
    CreateVessel,
    EditVessel,
    CategoriesList,
    CreateCategory,
    EditCategory,
    Quotations,
    RfqList,
    CreateRfq,
    ConfirmRfq,
    RfqEmail,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
  bootstrap: [App],
})
export class AppModule { }
