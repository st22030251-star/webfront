import "./App.css";
import Header from "./components/header/header";
import AppContext from "./components/contexto/appcontext";
import Main from "./components/main/main";
import apis from "./data/class";
import { useEffect, useState } from "react";

function App() {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apis.return.getallcards();
        setCards(res.data);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  async function deleteCard(card) {
    try {
      await apis.return.deleteCard(card._id);
      const newArray = cards.filter(
        (currentCard) => currentCard._id !== card._id
      );
      setCards(newArray);
    } catch (error) {
      console.error(error);
    }
  }

  const like = async (card, likeValue) => {
    try {
      await apis.return.likeCard(card._id, likeValue);
      setCards((prev) =>
        prev.map((element) =>
          element._id === card._id ? { ...element, like: likeValue } : element
        )
      );
    } catch (error) {
      console.error(error);
    }
  };
  
  return (
    <AppContext.Provider>
      <div className="app">
        <Header />
        <Main props={cards} deleteCard={deleteCard} like={like} />
      </div>
    </AppContext.Provider>
  );
}

export default App;
