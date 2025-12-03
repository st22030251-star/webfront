import './main.css';
import Profile from '../profile/profile';
import CardContainer from '../cardcontainrer/cardContainer';

function Main({props, deleteCard, like}) {
    return (
        <main className="main">
            <section className="travel">
                <Profile />
            </section>
            <section className="galery">
                <CardContainer props={props} deleteCard={deleteCard} like={like} />
            </section>
        </main>
    );
}

export default Main;