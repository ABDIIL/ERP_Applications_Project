using { my.project as my } from '../db/schema';

service ApplicatieService {

  entity Artiesten     as projection on my.Artiest;
  entity Reviews       as projection on my.Review;

  entity Klanten       as projection on my.Klant;
  entity Orders        as projection on my.Order;
  entity OrderItems    as projection on my.OrderItem;
  entity Producten     as projection on my.Product;

  entity Stages        as projection on my.Stage;
  entity FestivalDagen as projection on my.FestivalDag;
  entity Optredens     as projection on my.Optreden;

}
