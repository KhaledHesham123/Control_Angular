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
import { RfqOffers } from './rfq/rfq-offers';
import { SupplierBoard } from './suppliers/supplier-board';
import { CategoryLookup } from './shared/category-lookup';
import { CreateVessel } from './vessels/create-vessel';
import { EditVessel } from './vessels/edit-vessel';
import { VesselsList } from './vessels/vessels-list';
import { ShipShell } from './ship/ship-shell';
import { ShipIcon } from './ship/ui/ship-icon';
import { ShipCatTree } from './ship/ui/ship-cat-tree';
import { ShipViewer } from './ship/ui/ship-viewer';
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
import { ShNoon } from './ship/pages/sh-noon';
import { ShPlanner } from './ship/pages/sh-planner';
import { ShPorts } from './ship/pages/sh-ports';
import { ShClients } from './ship/pages/sh-clients';
import { ShSuppliers } from './ship/pages/sh-suppliers';
import { ShCatalog } from './ship/pages/sh-catalog';
import { ShCrew } from './ship/pages/sh-crew';
import { ShCertificates } from './ship/pages/sh-certificates';
import { ShUsers } from './ship/pages/sh-users';
import { ShSettings } from './ship/pages/sh-settings';

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
    ShipShell,
    ShipIcon,
    ShipCatTree,
    ShipViewer,
    ShDashboard,
    ShReports,
    ShFleet,
    ShParticulars,
    ShRequests,
    ShRequestNew,
    ShRequestDetail,
    ShStores,
    ShTanks,
    ShDaily,
    ShLog,
    ShVoyages,
    ShNoon,
    ShPlanner,
    ShPorts,
    ShClients,
    ShSuppliers,
    ShCatalog,
    ShCrew,
    ShCertificates,
    ShUsers,
    ShSettings,
    CategoriesList,
    CreateCategory,
    EditCategory,
    Quotations,
    RfqList,
    RfqOffers,
    SupplierBoard,
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
