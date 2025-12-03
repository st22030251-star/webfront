import './cardConatiner.css'
import Card from '../card/card';

function CardContainer({ props, deleteCard, like}) {
    const cards = props
    return (
        <>
            <section className="card-container">
                <ul className="card-container__list">
                    {cards.map((card) => <Card props={card} deleteCard={deleteCard} like={like} />)}
                </ul>
            </section>
        </>
    )
}

export default CardContainer;