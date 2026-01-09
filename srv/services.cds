using { my.project as my } from '../db/schema.cds';

service ApplicatieService {

    entity Artiest as projection on my.Artiest;

}