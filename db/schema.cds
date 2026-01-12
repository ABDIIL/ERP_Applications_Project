namespace my.project;

type Genre : String enum {
  techno    = 'TECHNO';
  pop       = 'POP';
  hardstyle = 'HARDSTYLE';
  indie     = 'INDIE';
  house     = 'HOUSE';
  anders    = 'ANDERS';
}

type OrderType : String enum {
  tickets     = 'TICKETS';
  merchandise = 'MERCHANDISE';
  foodDrinks  = 'FOOD_DRINKS';
}

type OrderStatus : String enum {
  open        = 'OPEN';
  betaald     = 'BETAALD';
  geannuleerd = 'GEANNULEERD';
}

type ProductCategorie : String enum {
  tickets     = 'TICKETS';
  merchandise = 'MERCHANDISE';
  foodDrinks  = 'FOOD_DRINKS';
}

entity Artiest {
  key ID: Integer;
  artiestNaam: String;

  genre: Genre;

  land: String;
  nationaliteit: String;

  // blijft: nodig voor artist-overview "popularity score"
  populariteit: Double;

  biografie: String(2000);

  reviews   : Composition of many Review   on reviews.artiest = $self;
  optredens : Association to many Optreden on optredens.artiest = $self;

  // tijdreeks voor trendgrafiek (meerdere punten)
  populariteitPunten : Composition of many PopulariteitPunt
    on populariteitPunten.artiest = $self;
}

entity PopulariteitPunt {
  key ID: Integer;

  // tijd-as voor microchart
  datum: Date;

  // de score op dat moment
  score: Double;

  // verplicht: hoort bij 1 artiest
  artiest: Association to Artiest;

  // optioneel: punt kan gekoppeld zijn aan een optreden (bv. na optreden score update)
  optreden: Association to Optreden;
}

entity Review {
  key ID: Integer;
  rating: Integer;
  commentaar: String;
  datum: Date;
  klantNaam: String;

  artiest: Association to Artiest;
}

entity Klant {
  key ID: Integer;
  klantNaam: String;

  orders: Association to many Order on orders.klant = $self;
}

entity Order {
  key ID: Integer;
  orderDatum: Date;
  orderType: OrderType;
  status: OrderStatus;
  totaleBedrag: Double;

  klant: Association to Klant;
  items: Composition of many OrderItem on items.order = $self;
}

entity Product {
  key ID: Integer;
  naam: String;
  categorie: ProductCategorie;
  prijs: Double;

  orderItems: Association to many OrderItem on orderItems.product = $self;
}

entity OrderItem {
  key order: Association to Order;
  key pos: Integer;

  product: Association to Product;

  aantal: Integer;
  eenheidsPrijs: Double;
  subtotaal: Double;
}

entity Stage {
  key ID: Integer;
  stageNaam: String;

  optredens: Association to many Optreden on optredens.stage = $self;
}

entity FestivalDag {
  key ID: Integer;
  datum: Date;

  optredens: Association to many Optreden on optredens.festivalDag = $self;
}

entity Optreden {
  key ID: Integer;

  artiest: Association to Artiest;
  stage: Association to Stage;
  festivalDag: Association to FestivalDag;

  startTijd: Time;
  eindTijd: Time;

  // (optioneel) inverse link, niet nodig maar handig
  populariteitPunten: Association to many PopulariteitPunt
    on populariteitPunten.optreden = $self;
}
