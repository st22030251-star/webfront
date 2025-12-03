class api{
    constructor(url,headers){
        this.url = url;
        this.headers = headers
    }

    getallcards(){
        return fetch(this.url+'/getallcards',this.headers)
            .then(res => res.json())
            .then(data => ({
                ...data,
                data: data.data.sort((a, b) => b.like - a.like)
            }))
    }

    deleteCard(id){
        return fetch(`${this.url}/deletecard/${id}`,{
            method:'DELETE',
            headers:this.headers,
        })
    }

    likeCard(id, isLiked){
        return fetch(`${this.url}/updatecard/${id}`,{
            method:'PUT',
            headers:this.headers,
            body: JSON.stringify({ like: isLiked })
        })
    }
}

const apis = {
    return: new api('https://web2xd.onrender.com',{
        "Content-type": "application/json",
    }),
}

export default apis