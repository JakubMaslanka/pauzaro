## Opis projektu

Celem projektu jest stworzenie aplikacji desktopowej zbudowanej w **Tauri**, z frontendem napisanym w **React**. Aplikacja ma działać jak konfigurowalne „Duolingo do budowania nawyków” — ma pomagać w regularnym wykonywaniu krótkich, zaplanowanych aktywności w ciągu dnia.

Inspiracją jest problem, z którym spotykam się podczas pracy jako programista. Gdy siadam do komputera i skupiam się na rozwiązywaniu problemu, często tracę poczucie czasu i zapominam o regularnych przerwach, ruchu oraz odejściu od ekranu. Na rynku istnieją podobne rozwiązania, jednak wiele z nich jest płatnych, a potrzebna mi funkcjonalność wydaje się stosunkowo prosta. Chciałbym więc stworzyć własne, lekkie i konfigurowalne narzędzie.

## Główny przypadek użycia

Przykładem nawyku, który aplikacja powinna obsługiwać, są ćwiczenia. Niedawno kupiłem drążek i chcę regularnie się podciągać w trakcie dnia pracy.

Użytkownik powinien mieć możliwość skonfigurowania:

* dni tygodnia, w których dany nawyk ma być realizowany,
* godzin lub przedziałów czasowych przypomnień,
* liczby wymaganych wykonań w ciągu dnia,
* treści zadania oraz sposobu jego potwierdzenia.

Przykładowy scenariusz:

* Pracuję przy komputerze od godziny 9:30.
* O 10:30 aplikacja wyświetla powiadomienie lub wyraźny prompt: „Idź się podciągać”.
* Przerywam pracę, wykonuję krótką serię podciągnięć i ewentualnie się rozciągam.
* Po powrocie do aplikacji oznaczam zadanie jako wykonane.

Docelowo przypomnienie może mieć formę systemowego powiadomienia albo bardziej wyrazistego okna aplikacji, które przyciąga uwagę i zachęca do rzeczywistego przerwania pracy. W bardziej restrykcyjnej wersji aplikacja mogłaby ograniczać możliwość dalszego korzystania z komputera do momentu wykonania zadania lub świadomego pominięcia go.

## Budowanie serii i gamifikacja

Kluczowym elementem aplikacji ma być system **streaków**, inspirowany Duolingo.

Dla każdego nawyku użytkownik określa dzienny cel. Przykładowo: chcę podciągnąć się trzy razy dziennie w ciągu 8–10 godzin pracy przy komputerze. Każde wykonane ćwiczenie przybliża mnie do realizacji celu dziennego.

Jeżeli wykonam wszystkie trzy zaplanowane serie danego dnia:

* zaliczam dzień jako ukończony,
* moja seria zostaje rozpoczęta lub przedłużona o kolejny dzień,
* aplikacja może wizualnie nagrodzić mnie za konsekwencję.

Jeżeli otrzymam przypomnienie, ale oznaczę je jako zignorowane lub nie wykonam wymaganej liczby aktywności danego dnia, seria powinna być zagrożona.

Podobnie jak w Duolingo, aplikacja powinna posiadać mechanizm **zamrożenia serii** (*streak freeze*). Użytkownik może ochronić swoją serię maksymalnie przez dwa dni. Jeśli nie zrealizuje nawyku przez więcej niż dwa kolejne dni, seria przepada i musi zostać zbudowana od nowa.

## Stan projektu

Projekt jest na etapie **greenfield**. Repozytorium zawiera jedynie zainicjalizowany projekt Tauri — bez zaimplementowanej logiki biznesowej, interfejsu ani funkcjonalności aplikacji. Oznacza to, że cały produkt zaczynamy budować od zera.

## Identyfikacja aplikacji

Robocza nazwa aplikacji to **Pauzaro**.

Jako przyjemny element doświadczenia użytkownika aplikacja powinna mieć własną maskotkę. Tak jak Duolingo ma swojego ptaka, Pauzaro mogłoby mieć małego, słodkiego dinozaura — kompana wspierającego użytkownika podczas budowania zdrowych nawyków, robienia przerw i utrzymywania serii.

