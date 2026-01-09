namespace my.project;

entity Artiest{
    key ID: Integer;
    artiestNaam: String;
    genre: String;   //kan ook een enum worden
    land: String;
    nationaliteit: String;
    populariteit: Double;

}

entity Order{
    key ID: Integer;
    klantNaam: String;
    orderType: String;
    status: String;
    totaleBedrag: Double;
}